"""Cloudflare R2 (S3-compatible) storage backend.

When R2 credentials are configured (via environment variables), binary
output files (generated images/videos, uploaded references) are written
to and read from the R2 bucket instead of the local filesystem, so they
survive serverless cold starts and redeploys on Vercel.

Falls back to no-op (`is_configured() == False`) when credentials are
missing, so local development keeps using the plain local-disk path in
main.py unchanged.
"""
import os
import mimetypes
import urllib.parse
import logging
import time
from typing import Optional
logger = logging.getLogger(__name__)

_R2_ACCOUNT_ID = str(os.getenv("R2_ACCOUNT_ID", "")).strip()
_R2_ACCESS_KEY_ID = str(os.getenv("R2_ACCESS_KEY_ID", "")).strip()
_R2_SECRET_ACCESS_KEY = str(os.getenv("R2_SECRET_ACCESS_KEY", "")).strip()
_R2_BUCKET_NAME = str(os.getenv("R2_BUCKET_NAME", "")).strip()
_R2_PUBLIC_BASE_URL = str(os.getenv("R2_PUBLIC_BASE_URL", "")).strip().rstrip("/")

_client = None
_client_error = None
_client_error_at = 0.0
_CLIENT_RETRY_SECONDS = 15.0


def is_configured() -> bool:
    return bool(_R2_ACCOUNT_ID and _R2_ACCESS_KEY_ID and _R2_SECRET_ACCESS_KEY and _R2_BUCKET_NAME)


def public_base_url() -> str:
    return _R2_PUBLIC_BASE_URL


def _get_client():
    global _client, _client_error, _client_error_at
    if _client is not None:
        return _client
    if _client_error is not None:
        if time.monotonic() - _client_error_at < _CLIENT_RETRY_SECONDS:
            return None
        _client_error = None
        _client_error_at = 0.0
    if not is_configured():
        return None
    try:
        import boto3
        from botocore.config import Config
        _client = boto3.client(
            "s3",
            endpoint_url=f"https://{_R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
            aws_access_key_id=_R2_ACCESS_KEY_ID,
            aws_secret_access_key=_R2_SECRET_ACCESS_KEY,
            config=Config(
                signature_version="s3v4",
                connect_timeout=3.0,
                read_timeout=20.0,
                retries={"max_attempts": 2, "mode": "standard"},
            ),
            region_name="auto",
        )
        return _client
    except Exception as exc:
        _client_error = exc
        _client_error_at = time.monotonic()
        logger.info(f"[storage_r2] failed to init R2 client: {exc}")
        return None


def _guess_content_type(rel_path: str) -> str:
    guessed, _ = mimetypes.guess_type(rel_path)
    return guessed or "application/octet-stream"


def public_url_for(rel_path: str) -> Optional[str]:
    """Public URL for an object key, or None if no public base URL is configured."""
    if not _R2_PUBLIC_BASE_URL:
        return None
    clean = str(rel_path or "").replace("\\", "/").lstrip("/")
    return f"{_R2_PUBLIC_BASE_URL}/{urllib.parse.quote(clean, safe='/')}"


def key_from_public_url(url: str) -> Optional[str]:
    """反向映射：把 R2 公共 CDN 地址还原为对象键（无公共域名时返回 None）。"""
    if not _R2_PUBLIC_BASE_URL:
        return None
    text = str(url or "").strip()
    base = _R2_PUBLIC_BASE_URL.rstrip("/")
    if not text.startswith(base + "/"):
        return None
    key = urllib.parse.unquote(text[len(base) + 1:].split("?", 1)[0]).replace("\\", "/").lstrip("/")
    return key or None


def upload_bytes(rel_path: str, data: bytes, content_type: str = "") -> bool:
    """Upload bytes to R2 under the given key (e.g. 'output/foo.png'). Returns True on success."""
    client = _get_client()
    if not client:
        return False
    clean = str(rel_path or "").replace("\\", "/").lstrip("/")
    if not clean:
        return False
    try:
        client.put_object(
            Bucket=_R2_BUCKET_NAME,
            Key=clean,
            Body=data,
            ContentType=content_type or _guess_content_type(clean),
        )
        return True
    except Exception as exc:
        logger.info(f"[storage_r2] upload failed for {clean}: {exc}")
        return False


def upload_file(rel_path: str, local_path: str, content_type: str = "") -> bool:
    client = _get_client()
    if not client:
        return False
    clean = str(rel_path or "").replace("\\", "/").lstrip("/")
    if not clean:
        return False
    try:
        extra_args = {"ContentType": content_type or _guess_content_type(clean)}
        client.upload_file(local_path, _R2_BUCKET_NAME, clean, ExtraArgs=extra_args)
        return True
    except Exception as exc:
        logger.info(f"[storage_r2] upload_file failed for {clean}: {exc}")
        return False


def download_bytes(rel_path: str) -> Optional[bytes]:
    client = _get_client()
    if not client:
        return None
    clean = str(rel_path or "").replace("\\", "/").lstrip("/")
    if not clean:
        return None
    try:
        resp = client.get_object(Bucket=_R2_BUCKET_NAME, Key=clean)
        return resp["Body"].read()
    except Exception:
        return None


def download_to_file(rel_path: str, local_path: str) -> bool:
    client = _get_client()
    if not client:
        return False
    clean = str(rel_path or "").replace("\\", "/").lstrip("/")
    if not clean:
        return False
    try:
        os.makedirs(os.path.dirname(local_path) or ".", exist_ok=True)
        client.download_file(_R2_BUCKET_NAME, clean, local_path)
        return True
    except Exception:
        return False


def object_exists(rel_path: str) -> bool:
    client = _get_client()
    if not client:
        return False
    clean = str(rel_path or "").replace("\\", "/").lstrip("/")
    if not clean:
        return False
    try:
        client.head_object(Bucket=_R2_BUCKET_NAME, Key=clean)
        return True
    except Exception:
        return False


def object_exists_status(rel_path: str) -> Optional[bool]:
    """HEAD 检查对象是否存在：True=存在，False=确定不存在，None=未知（网络/权限等异常）。"""
    client = _get_client()
    if not client:
        return None
    clean = str(rel_path or "").replace("\\", "/").lstrip("/")
    if not clean:
        return False
    try:
        client.head_object(Bucket=_R2_BUCKET_NAME, Key=clean)
        return True
    except Exception as exc:
        message = str(exc)
        error = (getattr(exc, "response", None) or {}).get("Error", {}) if hasattr(exc, "response") else {}
        code = str(error.get("Code", "") or "")
        if "NoSuchKey" in message or code == "NoSuchKey" or "404" in message:
            return False
        return None


def list_objects(prefix: str):
    """List objects under a key prefix. Returns a list of dicts with key/size/last_modified."""
    client = _get_client()
    if not client:
        return []
    clean_prefix = str(prefix or "").replace("\\", "/").lstrip("/")
    items = []
    try:
        paginator = client.get_paginator("list_objects_v2")
        for page in paginator.paginate(Bucket=_R2_BUCKET_NAME, Prefix=clean_prefix):
            for obj in page.get("Contents", []):
                items.append({
                    "key": obj["Key"],
                    "size": obj.get("Size", 0),
                    "last_modified": obj.get("LastModified"),
                })
    except Exception as exc:
        logger.info(f"[storage_r2] list_objects failed for {clean_prefix}: {exc}")
    return items


def delete_object(rel_path: str) -> bool:
    client = _get_client()
    if not client:
        return False
    clean = str(rel_path or "").replace("\\", "/").lstrip("/")
    if not clean:
        return False
    try:
        client.delete_object(Bucket=_R2_BUCKET_NAME, Key=clean)
        return True
    except Exception:
        return False
