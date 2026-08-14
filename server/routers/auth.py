from sql import unique_errors

from fastapi import APIRouter, Body, HTTPException, Request
from fastapi.responses import JSONResponse

from auth import (
    attach_session_cookie,
    clear_session_cookie,
    drop_session,
    hash_password,
    issue_session,
    require_user,
    verify_password,
)
from queries import create_user, get_board_for_user, get_user_by_email
from seed import seed_board_for_user

router = APIRouter()

EMAIL_MAX = 254
PASSWORD_MIN = 8
PASSWORD_MAX = 128


def _db(request: Request):
    return request.app.state.db


def _public_user(conn, user: dict) -> dict:
    board = get_board_for_user(conn, user["id"])
    return {
        "id": user["id"],
        "email": user["email"],
        "board_id": board["id"] if board else None,
    }


def _parse_credentials(body: dict, *, new_account: bool) -> tuple[str, str]:
    email_raw = body.get("email")
    password = body.get("password")
    if not isinstance(email_raw, str) or not email_raw.strip():
        raise HTTPException(status_code=400, detail="Email is required")
    email = email_raw.strip().lower()
    if "@" not in email or "." not in email.split("@")[-1] or len(email) > EMAIL_MAX:
        raise HTTPException(status_code=400, detail="Enter a valid email")
    if not isinstance(password, str) or not password:
        raise HTTPException(status_code=400, detail="Password is required")
    if new_account and len(password) < PASSWORD_MIN:
        raise HTTPException(status_code=400, detail=f"Password must be at least {PASSWORD_MIN} characters")
    if len(password) > PASSWORD_MAX:
        raise HTTPException(status_code=400, detail=f"Password must be {PASSWORD_MAX} characters or fewer")
    return email, password


@router.post("/register", status_code=201)
def register(request: Request, body: dict = Body(...)):
    email, password = _parse_credentials(body, new_account=True)
    conn = _db(request)
    if get_user_by_email(conn, email):
        raise HTTPException(status_code=400, detail="An account with that email already exists")

    try:
        user = create_user(conn, email=email, password_hash=hash_password(password))
    except unique_errors():
        conn.rollback()
        raise HTTPException(status_code=400, detail="An account with that email already exists")
    seed_board_for_user(conn, user["id"], sample_tasks=False)
    token, expires = issue_session(conn, user["id"])
    response = JSONResponse(_public_user(conn, user), status_code=201)
    return attach_session_cookie(response, token, expires)


@router.post("/login")
def login(request: Request, body: dict = Body(...)):
    email, password = _parse_credentials(body, new_account=False)
    conn = _db(request)
    stored = get_user_by_email(conn, email)
    if not stored or not verify_password(password, stored["password_hash"]):
        raise HTTPException(status_code=401, detail="Email or password is wrong")

    token, expires = issue_session(conn, stored["id"])
    user = {"id": stored["id"], "email": stored["email"]}
    response = JSONResponse(_public_user(conn, user))
    return attach_session_cookie(response, token, expires)


@router.post("/logout")
def logout(request: Request):
    drop_session(_db(request), request)
    response = JSONResponse({"ok": True})
    return clear_session_cookie(response)


@router.get("/me")
def me(request: Request):
    user = require_user(request)
    return _public_user(_db(request), user)
