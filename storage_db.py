"""Postgres-backed key/value document store (Neon or any Postgres).

The rest of the app already treats canvases, canvas tasks, and projects as
opaque JSON blobs read/written to local files. This module provides a tiny
JSON-document store with the same shape (collection + id -> JSON dict) so
those call sites can keep their existing local-file behavior for local dev,
but persist to Postgres in production where the filesystem is ephemeral.

Falls back to `is_configured() == False` when DATABASE_URL is not set, so
callers should always check that first and use the local-file path instead.
"""
import os
import json
import threading
from typing import Any, Dict, List, Optional

_DATABASE_URL = str(os.getenv("DATABASE_URL", "")).strip()

_lock = threading.Lock()
_conn = None
_init_error = None
_schema_ready = False


def is_configured() -> bool:
    return bool(_DATABASE_URL)


def _connect():
    global _conn, _init_error
    if _conn is not None:
        try:
            # cheap liveness check
            _conn.execute("SELECT 1")
            return _conn
        except Exception:
            try:
                _conn.close()
            except Exception:
                pass
            _conn = None
    if _init_error is not None:
        return None
    try:
        import psycopg
        _conn = psycopg.connect(_DATABASE_URL, autocommit=True)
        return _conn
    except Exception as exc:
        _init_error = exc
        print(f"[storage_db] failed to connect to Postgres: {exc}")
        return None


def _ensure_schema(conn) -> bool:
    global _schema_ready
    if _schema_ready:
        return True
    try:
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS kv_documents (
                collection TEXT NOT NULL,
                doc_id TEXT NOT NULL,
                data JSONB NOT NULL,
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                PRIMARY KEY (collection, doc_id)
            )
            """
        )
        _schema_ready = True
        return True
    except Exception as exc:
        print(f"[storage_db] failed to ensure schema: {exc}")
        return False


def kv_get(collection: str, doc_id: str) -> Optional[Dict[str, Any]]:
    with _lock:
        conn = _connect()
        if not conn or not _ensure_schema(conn):
            return None
        try:
            cur = conn.execute(
                "SELECT data FROM kv_documents WHERE collection = %s AND doc_id = %s",
                (collection, doc_id),
            )
            row = cur.fetchone()
            return row[0] if row else None
        except Exception as exc:
            print(f"[storage_db] kv_get failed ({collection}/{doc_id}): {exc}")
            return None


def kv_set(collection: str, doc_id: str, data: Dict[str, Any]) -> bool:
    with _lock:
        conn = _connect()
        if not conn or not _ensure_schema(conn):
            return False
        try:
            payload = json.dumps(data, ensure_ascii=False, default=str)
            conn.execute(
                """
                INSERT INTO kv_documents (collection, doc_id, data, updated_at)
                VALUES (%s, %s, %s::jsonb, now())
                ON CONFLICT (collection, doc_id)
                DO UPDATE SET data = EXCLUDED.data, updated_at = now()
                """,
                (collection, doc_id, payload),
            )
            return True
        except Exception as exc:
            print(f"[storage_db] kv_set failed ({collection}/{doc_id}): {exc}")
            return False


def kv_delete(collection: str, doc_id: str) -> bool:
    with _lock:
        conn = _connect()
        if not conn or not _ensure_schema(conn):
            return False
        try:
            conn.execute(
                "DELETE FROM kv_documents WHERE collection = %s AND doc_id = %s",
                (collection, doc_id),
            )
            return True
        except Exception as exc:
            print(f"[storage_db] kv_delete failed ({collection}/{doc_id}): {exc}")
            return False


def kv_list(collection: str) -> List[Dict[str, Any]]:
    with _lock:
        conn = _connect()
        if not conn or not _ensure_schema(conn):
            return []
        try:
            cur = conn.execute(
                "SELECT data FROM kv_documents WHERE collection = %s",
                (collection,),
            )
            return [row[0] for row in cur.fetchall()]
        except Exception as exc:
            print(f"[storage_db] kv_list failed ({collection}): {exc}")
            return []
