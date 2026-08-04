"""Postgres-backed key/value document store (Neon or any Postgres).

The rest of the app already treats canvases, canvas tasks, and projects as
opaque JSON blobs read/written to local files. This module provides a tiny
JSON-document store with the same shape (collection + id -> JSON dict) so
those call sites can keep their existing local-file behavior for local dev,
but persist to Postgres in production where the filesystem is ephemeral.

Falls back to `is_configured() == False` when DATABASE_URL is not set, so
callers should always check that first and use the local-file path instead.

连接策略：
- `_connect()` 会把连接缓存到模块级 `_conn`，同一个函数实例内复用，不会每次请求重连；
- 支持 Neon pooled connection：直接把 Neon 控制台的 "Pooled connection"
  （pgBouncer，主机名带 `-pooler`）字符串配置到 `DATABASE_URL` 即可，代码无需区分；
- 连接失败时保留现有降级（local-file）与调用方重试逻辑，不会抛出致命错误。
"""
import os
import json
import threading
import time
import uuid
import datetime
import hmac
import logging
from typing import Any, Dict, List, Optional
logger = logging.getLogger(__name__)

_DATABASE_URL = str(os.getenv("DATABASE_URL", "")).strip()

_lock = threading.Lock()
_conn = None
_init_error = None
_schema_ready = False
_connection_generation = 0
_last_connect_duration_ms = 0.0


def connection_generation() -> int:
    """当前连接代数（每次新建连接 +1），供接口判断本次请求是否发生了冷连接。"""
    return _connection_generation


def last_connect_duration_ms() -> float:
    return _last_connect_duration_ms


def is_configured() -> bool:
    return bool(_DATABASE_URL)


def ping() -> bool:
    """Cheap liveness check that also establishes/warms the Postgres connection.

    Used by /api/health so a scheduled cron can keep serverless databases
    (e.g. Neon) awake and avoid multi-second cold starts on first real request.
    """
    if not is_configured():
        return False
    with _lock:
        conn = _connect()
        if not conn:
            return False
        try:
            conn.execute("SELECT 1")
            return True
        except Exception as exc:
            logger.info(f"[storage_db] ping failed: {exc}")
            return False


def warmup_connect() -> bool:
    """预热：建立/复用连接并执行最小 SELECT 1。不读业务数据、不写库。"""
    if not is_configured():
        return False
    with _lock:
        conn = _connect()
        if not conn:
            return False
        try:
            conn.execute("SELECT 1")
            return True
        except Exception as exc:
            logger.info(f"[storage_db] warmup ping failed: {type(exc).__name__}")
            return False


def _connect():
    global _conn, _init_error
    global _connection_generation, _last_connect_duration_ms
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
        started = time.monotonic()
        try:
            _conn = psycopg.connect(
                _DATABASE_URL,
                autocommit=True,
                connect_timeout=10,
                keepalives=1,
                keepalives_idle=30,
                keepalives_interval=10,
                keepalives_count=5,
                options="-c statement_timeout=15000",
            )
        except Exception:
            # 池化连接（pgBouncer 等）可能不接受 startup options：去掉 options 重试一次。
            _conn = psycopg.connect(
                _DATABASE_URL,
                autocommit=True,
                connect_timeout=10,
                keepalives=1,
                keepalives_idle=30,
                keepalives_interval=10,
                keepalives_count=5,
            )
        _last_connect_duration_ms = (time.monotonic() - started) * 1000.0
        _connection_generation += 1
        return _conn
    except Exception as exc:
        _init_error = exc
        # 只记录异常类型，避免连接串/主机/用户名等敏感信息进入日志
        logger.info(f"[storage_db] failed to connect to Postgres: {type(exc).__name__}")
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
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id TEXT PRIMARY KEY,
                email TEXT UNIQUE,
                wechat_openid TEXT UNIQUE,
                wechat_unionid TEXT UNIQUE,
                provider TEXT NOT NULL DEFAULT 'email',
                password_hash TEXT NOT NULL DEFAULT '',
                nickname TEXT NOT NULL DEFAULT '',
                avatar_url TEXT NOT NULL DEFAULT '',
                raw JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                last_login_at TIMESTAMPTZ NOT NULL DEFAULT now()
            )
            """
        )
        conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS email TEXT UNIQUE")
        conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS provider TEXT NOT NULL DEFAULT 'email'")
        conn.execute("ALTER TABLE users ADD COLUMN IF NOT EXISTS password_hash TEXT NOT NULL DEFAULT ''")
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS email_login_codes (
                id TEXT PRIMARY KEY,
                email TEXT NOT NULL,
                code_hash TEXT NOT NULL,
                expires_at TIMESTAMPTZ NOT NULL,
                attempts INT NOT NULL DEFAULT 0,
                consumed_at TIMESTAMPTZ,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                ip TEXT NOT NULL DEFAULT '',
                user_agent TEXT NOT NULL DEFAULT ''
            )
            """
        )
        conn.execute(
            """
            CREATE TABLE IF NOT EXISTS sessions (
                id TEXT PRIMARY KEY,
                user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                session_hash TEXT NOT NULL UNIQUE,
                expires_at TIMESTAMPTZ NOT NULL,
                created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
                user_agent TEXT NOT NULL DEFAULT '',
                ip TEXT NOT NULL DEFAULT ''
            )
            """
        )
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_hash ON sessions(session_hash)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id)")
        conn.execute("CREATE INDEX IF NOT EXISTS idx_email_login_codes_email ON email_login_codes(email)")
        _schema_ready = True
        return True
    except Exception as exc:
        logger.info(f"[storage_db] failed to ensure schema: {exc}")
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
            logger.info(f"[storage_db] kv_get failed ({collection}/{doc_id}): {exc}")
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
            logger.info(f"[storage_db] kv_set failed ({collection}/{doc_id}): {exc}")
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
            logger.info(f"[storage_db] kv_delete failed ({collection}/{doc_id}): {exc}")
            return False


def kv_touch(collection: str, doc_id: str, user_id: str = "", updated_at: int = 0) -> Optional[int]:
    """轻量 touch：只更新 updated_at 并返回新值，不读取/重写整份文档。

    返回 None 表示文档不存在/无权访问（调用方按 404 处理）。
    """
    if not updated_at:
        updated_at = int(time.time() * 1000)
    with _lock:
        conn = _connect()
        if not conn or not _ensure_schema(conn):
            return None
        try:
            sql = (
                "UPDATE kv_documents SET data = data || jsonb_build_object('updated_at', %s), updated_at = now() "
                "WHERE collection = %s AND doc_id = %s AND COALESCE((data->>'deleted_at')::bigint, 0) = 0"
            )
            params = [updated_at, collection, doc_id]
            if user_id:
                sql += " AND data->>'user_id' = %s"
                params.append(user_id)
            sql += " RETURNING data->>'updated_at'"
            cur = conn.execute(sql, tuple(params))
            row = cur.fetchone()
            if not row or not row[0]:
                return None
            return int(float(row[0]))
        except Exception as exc:
            logger.info(f"[storage_db] kv_touch failed ({collection}/{doc_id}): {type(exc).__name__}")
            return None


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
            logger.info(f"[storage_db] kv_list failed ({collection}): {exc}")
            return []


def kv_list_meta(collection: str, fields: tuple) -> Optional[List[Dict[str, Any]]]:
    """轻量列出集合文档的指定 JSONB 字段，避免把整张画布 JSON 传到应用层。

    返回 None 表示数据库不可用（调用方回退到 kv_list 全量读取）。
    """
    if not fields:
        return None
    with _lock:
        conn = _connect()
        if not conn or not _ensure_schema(conn):
            return None
        try:
            select = ", ".join(f"data->>'{f}' AS {f}" for f in fields)
            cur = conn.execute(
                f"SELECT {select}, jsonb_array_length(COALESCE(data->'nodes', '[]'::jsonb)) AS node_count "
                "FROM kv_documents WHERE collection = %s ORDER BY (data->>'updated_at')::bigint DESC",
                (collection,),
            )
            rows = cur.fetchall()
            result = []
            for row in rows:
                item = {}
                for idx, field in enumerate(fields):
                    item[field] = row[idx]
                item["node_count"] = row[len(fields)]
                result.append(item)
            return result
        except Exception as exc:
            logger.info(f"[storage_db] kv_list_meta failed ({collection}): {exc}")
            return None


def _json_payload(data: Dict[str, Any]) -> str:
    return json.dumps(data or {}, ensure_ascii=False, default=str)


def _user_from_row(row) -> Optional[Dict[str, Any]]:
    if not row:
        return None
    if len(row) >= 12:
        return {
            "id": row[0],
            "email": row[1] or "",
            "wechat_openid": row[2] or "",
            "wechat_unionid": row[3] or "",
            "provider": row[4] or "",
            "password_hash": row[5] or "",
            "nickname": row[6] or "",
            "avatar_url": row[7] or "",
            "raw": row[8] if isinstance(row[8], dict) else {},
            "created_at": row[9].isoformat() if hasattr(row[9], "isoformat") else row[9],
            "updated_at": row[10].isoformat() if hasattr(row[10], "isoformat") else row[10],
            "last_login_at": row[11].isoformat() if hasattr(row[11], "isoformat") else row[11],
        }
    return {
        "id": row[0],
        "email": "",
        "wechat_openid": row[1] or "",
        "wechat_unionid": row[2] or "",
        "provider": "wechat",
        "nickname": row[3] or "",
        "avatar_url": row[4] or "",
        "raw": row[5] if isinstance(row[5], dict) else {},
        "created_at": row[6].isoformat() if hasattr(row[6], "isoformat") else row[6],
        "updated_at": row[7].isoformat() if hasattr(row[7], "isoformat") else row[7],
        "last_login_at": row[8].isoformat() if hasattr(row[8], "isoformat") else row[8],
    }


def upsert_wechat_user(openid: str, unionid: str = "", nickname: str = "", avatar_url: str = "", raw: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    openid = str(openid or "").strip()
    unionid = str(unionid or "").strip() or None
    if not openid:
        return None
    with _lock:
        conn = _connect()
        if not conn or not _ensure_schema(conn):
            return None
        try:
            cur = conn.execute(
                """
                SELECT id, email, wechat_openid, wechat_unionid, provider, password_hash, nickname, avatar_url, raw, created_at, updated_at, last_login_at
                FROM users
                WHERE wechat_openid = %s OR (%s IS NOT NULL AND wechat_unionid = %s)
                LIMIT 1
                """,
                (openid, unionid, unionid),
            )
            row = cur.fetchone()
            user_id = row[0] if row else uuid.uuid4().hex
            payload = _json_payload(raw or {})
            conn.execute(
                """
                INSERT INTO users (id, wechat_openid, wechat_unionid, provider, nickname, avatar_url, raw, created_at, updated_at, last_login_at)
                VALUES (%s, %s, %s, 'wechat', %s, %s, %s::jsonb, now(), now(), now())
                ON CONFLICT (id)
                DO UPDATE SET
                    wechat_openid = EXCLUDED.wechat_openid,
                    wechat_unionid = COALESCE(EXCLUDED.wechat_unionid, users.wechat_unionid),
                    provider = EXCLUDED.provider,
                    nickname = EXCLUDED.nickname,
                    avatar_url = EXCLUDED.avatar_url,
                    raw = EXCLUDED.raw,
                    updated_at = now(),
                    last_login_at = now()
                """,
                (user_id, openid, unionid, str(nickname or "")[:120], str(avatar_url or "")[:1000], payload),
            )
            cur = conn.execute(
                """
                SELECT id, email, wechat_openid, wechat_unionid, provider, password_hash, nickname, avatar_url, raw, created_at, updated_at, last_login_at
                FROM users WHERE id = %s
                """,
                (user_id,),
            )
            return _user_from_row(cur.fetchone())
        except Exception as exc:
            logger.info(f"[storage_db] upsert_wechat_user failed: {exc}")
            return None


def upsert_email_user(email: str) -> Optional[Dict[str, Any]]:
    email = str(email or "").strip().lower()
    if not email:
        return None
    with _lock:
        conn = _connect()
        if not conn or not _ensure_schema(conn):
            return None
        try:
            user_id = uuid.uuid4().hex
            nickname = email.split("@", 1)[0][:80] or "User"
            conn.execute(
                """
                INSERT INTO users (id, email, provider, nickname, raw, created_at, updated_at, last_login_at)
                VALUES (%s, %s, 'email', %s, %s::jsonb, now(), now(), now())
                ON CONFLICT (email)
                DO UPDATE SET
                    provider = 'email',
                    nickname = COALESCE(NULLIF(users.nickname, ''), EXCLUDED.nickname),
                    updated_at = now(),
                    last_login_at = now()
                """,
                (user_id, email, nickname, _json_payload({"provider": "email"})),
            )
            cur = conn.execute(
                """
                SELECT id, email, wechat_openid, wechat_unionid, provider, password_hash, nickname, avatar_url, raw, created_at, updated_at, last_login_at
                FROM users WHERE email = %s
                """,
                (email,),
            )
            return _user_from_row(cur.fetchone())
        except Exception as exc:
            logger.info(f"[storage_db] upsert_email_user failed: {exc}")
            return None


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    email = str(email or "").strip().lower()
    if not email:
        return None
    with _lock:
        conn = _connect()
        if not conn or not _ensure_schema(conn):
            return None
        try:
            cur = conn.execute(
                """
                SELECT id, email, wechat_openid, wechat_unionid, provider, password_hash, nickname, avatar_url, raw, created_at, updated_at, last_login_at
                FROM users WHERE email = %s
                """,
                (email,),
            )
            return _user_from_row(cur.fetchone())
        except Exception as exc:
            logger.info(f"[storage_db] get_user_by_email failed: {exc}")
            return None


def create_email_password_user(email: str, nickname: str, password_hash: str) -> Optional[Dict[str, Any]]:
    email = str(email or "").strip().lower()
    nickname = str(nickname or "").strip()[:80]
    password_hash = str(password_hash or "").strip()
    if not email or not nickname or not password_hash:
        return None
    with _lock:
        conn = _connect()
        if not conn or not _ensure_schema(conn):
            return None
        try:
            cur = conn.execute(
                """
                SELECT id, email, wechat_openid, wechat_unionid, provider, password_hash, nickname, avatar_url, raw, created_at, updated_at, last_login_at
                FROM users WHERE email = %s
                """,
                (email,),
            )
            existing = _user_from_row(cur.fetchone())
            if existing and existing.get("password_hash"):
                return {"error": "exists"}
            user_id = existing.get("id") if existing else uuid.uuid4().hex
            conn.execute(
                """
                INSERT INTO users (id, email, provider, password_hash, nickname, raw, created_at, updated_at, last_login_at)
                VALUES (%s, %s, 'email-password', %s, %s, %s::jsonb, now(), now(), now())
                ON CONFLICT (email)
                DO UPDATE SET
                    provider = 'email-password',
                    password_hash = EXCLUDED.password_hash,
                    nickname = EXCLUDED.nickname,
                    updated_at = now(),
                    last_login_at = now()
                WHERE users.password_hash = ''
                """,
                (user_id, email, password_hash, nickname, _json_payload({"provider": "email-password"})),
            )
            cur = conn.execute(
                """
                SELECT id, email, wechat_openid, wechat_unionid, provider, password_hash, nickname, avatar_url, raw, created_at, updated_at, last_login_at
                FROM users WHERE email = %s
                """,
                (email,),
            )
            return _user_from_row(cur.fetchone())
        except Exception as exc:
            logger.info(f"[storage_db] create_email_password_user failed: {exc}")
            return None


def mark_user_login(user_id: str) -> bool:
    user_id = str(user_id or "").strip()
    if not user_id:
        return False
    with _lock:
        conn = _connect()
        if not conn or not _ensure_schema(conn):
            return False
        try:
            conn.execute("UPDATE users SET last_login_at = now(), updated_at = now() WHERE id = %s", (user_id,))
            return True
        except Exception as exc:
            logger.info(f"[storage_db] mark_user_login failed: {exc}")
            return False


def create_email_login_code(email: str, code_hash: str, expires_at: datetime.datetime, ip: str = "", user_agent: str = "") -> bool:
    email = str(email or "").strip().lower()
    if not email or not code_hash:
        return False
    with _lock:
        conn = _connect()
        if not conn or not _ensure_schema(conn):
            return False
        try:
            conn.execute(
                "UPDATE email_login_codes SET consumed_at = now() WHERE email = %s AND consumed_at IS NULL",
                (email,),
            )
            conn.execute(
                """
                INSERT INTO email_login_codes (id, email, code_hash, expires_at, ip, user_agent)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (uuid.uuid4().hex, email, code_hash, expires_at, str(ip or "")[:80], str(user_agent or "")[:500]),
            )
            return True
        except Exception as exc:
            logger.info(f"[storage_db] create_email_login_code failed: {exc}")
            return False


def consume_email_login_code(email: str, code_hash: str, max_attempts: int = 5) -> bool:
    email = str(email or "").strip().lower()
    if not email or not code_hash:
        return False
    with _lock:
        conn = _connect()
        if not conn or not _ensure_schema(conn):
            return False
        try:
            cur = conn.execute(
                """
                SELECT id, code_hash, attempts
                FROM email_login_codes
                WHERE email = %s AND consumed_at IS NULL AND expires_at > now()
                ORDER BY created_at DESC
                LIMIT 1
                """,
                (email,),
            )
            row = cur.fetchone()
            if not row:
                return False
            code_id, expected_hash, attempts = row[0], row[1], int(row[2] or 0)
            if attempts >= max_attempts:
                conn.execute("UPDATE email_login_codes SET consumed_at = now() WHERE id = %s", (code_id,))
                return False
            if not hmac.compare_digest(str(expected_hash), str(code_hash)):
                conn.execute("UPDATE email_login_codes SET attempts = attempts + 1 WHERE id = %s", (code_id,))
                return False
            conn.execute("UPDATE email_login_codes SET consumed_at = now() WHERE id = %s", (code_id,))
            return True
        except Exception as exc:
            logger.info(f"[storage_db] consume_email_login_code failed: {exc}")
            return False


def create_session(user_id: str, session_hash: str, expires_at: datetime.datetime, user_agent: str = "", ip: str = "") -> bool:
    with _lock:
        conn = _connect()
        if not conn or not _ensure_schema(conn):
            return False
        try:
            conn.execute(
                """
                INSERT INTO sessions (id, user_id, session_hash, expires_at, user_agent, ip)
                VALUES (%s, %s, %s, %s, %s, %s)
                """,
                (uuid.uuid4().hex, user_id, session_hash, expires_at, str(user_agent or "")[:500], str(ip or "")[:80]),
            )
            return True
        except Exception as exc:
            logger.info(f"[storage_db] create_session failed: {exc}")
            return False


def get_session(session_hash: str) -> Optional[Dict[str, Any]]:
    with _lock:
        conn = _connect()
        if not conn or not _ensure_schema(conn):
            return None
        try:
            cur = conn.execute(
                """
                SELECT s.id, s.expires_at,
                       u.id, u.email, u.wechat_openid, u.wechat_unionid, u.provider, u.password_hash, u.nickname, u.avatar_url, u.raw, u.created_at, u.updated_at, u.last_login_at
                FROM sessions s
                JOIN users u ON u.id = s.user_id
                WHERE s.session_hash = %s AND s.expires_at > now()
                LIMIT 1
                """,
                (session_hash,),
            )
            row = cur.fetchone()
            if not row:
                return None
            user = _user_from_row((row[2], row[3], row[4], row[5], row[6], row[7], row[8], row[9], row[10], row[11], row[12], row[13]))
            return {
                "id": row[0],
                "expires_at": row[1].isoformat() if hasattr(row[1], "isoformat") else row[1],
                "user": user,
            }
        except Exception as exc:
            logger.info(f"[storage_db] get_session failed: {exc}")
            return None


def delete_session(session_hash: str) -> bool:
    with _lock:
        conn = _connect()
        if not conn or not _ensure_schema(conn):
            return False
        try:
            conn.execute("DELETE FROM sessions WHERE session_hash = %s", (session_hash,))
            return True
        except Exception as exc:
            logger.info(f"[storage_db] delete_session failed: {exc}")
            return False
