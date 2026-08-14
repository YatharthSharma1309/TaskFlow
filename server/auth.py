"""Password hashing and session cookies. Stdlib only — no JWT library."""

from __future__ import annotations

import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import HTTPException, Request
from fastapi.responses import JSONResponse

from queries import (
    create_session,
    delete_session,
    get_board_for_user,
    get_session_user,
    get_task,
)

COOKIE_NAME = "tf_session"
SESSION_DAYS = 7
PBKDF2_ITERS = 390_000
SCHEME = "pbkdf2_sha256"


def hash_password(password: str) -> str:
    salt = os.urandom(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERS)
    return f"{SCHEME}${PBKDF2_ITERS}${salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        scheme, iters, salt_hex, digest_hex = stored.split("$")
        if scheme != SCHEME:
            return False
        digest = hashlib.pbkdf2_hmac(
            "sha256",
            password.encode("utf-8"),
            bytes.fromhex(salt_hex),
            int(iters),
        )
        return hmac.compare_digest(digest.hex(), digest_hex)
    except (ValueError, TypeError):
        return False


def issue_session(conn, user_id: int) -> tuple[str, datetime]:
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    create_session(conn, token, user_id, expires.strftime("%Y-%m-%dT%H:%M:%SZ"))
    return token, expires


def _cookie_flags() -> dict:
    secure = os.environ.get("TASKFLOW_SECURE_COOKIES", "").lower() in {"1", "true", "yes"}
    return {
        "httponly": True,
        "samesite": "lax",
        "path": "/",
        "secure": secure,
    }


def attach_session_cookie(response: JSONResponse, token: str, expires: datetime) -> JSONResponse:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        max_age=SESSION_DAYS * 24 * 3600,
        expires=expires,
        **_cookie_flags(),
    )
    return response


def clear_session_cookie(response: JSONResponse) -> JSONResponse:
    response.delete_cookie(COOKIE_NAME, **_cookie_flags())
    return response


def require_user(request: Request) -> dict:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        raise HTTPException(status_code=401, detail="Sign in required")
    conn = request.app.state.db
    user = get_session_user(conn, token)
    if not user:
        raise HTTPException(status_code=401, detail="Sign in required")
    return user


def require_board(conn, user: dict, board_id: int) -> dict:
    board = get_board_for_user(conn, user["id"])
    if not board or board["id"] != board_id:
        raise HTTPException(status_code=404, detail="Board not found")
    return board


def require_owned_task(conn, user: dict, task_id: int) -> dict:
    task = get_task(conn, task_id)
    if not task or task.get("user_id") != user["id"]:
        raise HTTPException(status_code=404, detail="Task not found")
    return task


def drop_session(conn, request: Request) -> None:
    token = request.cookies.get(COOKIE_NAME)
    if token:
        delete_session(conn, token)
