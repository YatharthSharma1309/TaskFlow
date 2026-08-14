from typing import Any

from fastapi import APIRouter, Body, HTTPException, Request
from fastapi.responses import Response

from auth import require_owned_task, require_user
from queries import create_task, delete_task, get_board_for_user, get_column, move_task, update_task
from validation import validate_create, validate_move, validate_update

router = APIRouter()


def _db(request: Request):
    return request.app.state.db


def _task_id(raw: str) -> int:
    try:
        value = int(raw)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid task id")
    if value < 1:
        raise HTTPException(status_code=400, detail="Invalid task id")
    return value


def _owned_column(conn, user, column):
    if not column:
        raise HTTPException(status_code=400, detail="Column not found")
    board = get_board_for_user(conn, user["id"])
    if not board or column["board_id"] != board["id"]:
        raise HTTPException(status_code=400, detail="Column not found")
    return column


@router.post("", status_code=201)
@router.post("/", status_code=201, include_in_schema=False)
def create(request: Request, body: dict[str, Any] = Body(...)):
    user = require_user(request)
    errors, value = validate_create(body)
    if errors:
        raise HTTPException(status_code=400, detail=errors[0])

    conn = _db(request)
    _owned_column(conn, user, get_column(conn, value["column_id"]))

    return create_task(conn, **value)


@router.patch("/{task_id}/move")
@router.patch("/{task_id}/move/", include_in_schema=False)
def move(task_id: str, request: Request, body: dict[str, Any] = Body(...)):
    user = require_user(request)
    tid = _task_id(task_id)
    conn = _db(request)
    existing = require_owned_task(conn, user, tid)

    errors, value = validate_move(body)
    if errors:
        raise HTTPException(status_code=400, detail=errors[0])
    column = _owned_column(conn, user, get_column(conn, value["column_id"]))
    if column["board_id"] != existing["board_id"]:
        raise HTTPException(status_code=400, detail="Column is not on this board")

    return move_task(conn, tid, value["column_id"])


@router.patch("/{task_id}")
@router.patch("/{task_id}/", include_in_schema=False)
def update(task_id: str, request: Request, body: dict[str, Any] = Body(...)):
    user = require_user(request)
    tid = _task_id(task_id)
    conn = _db(request)
    existing = require_owned_task(conn, user, tid)

    errors, value = validate_update(body)
    if errors:
        raise HTTPException(status_code=400, detail=errors[0])

    if value.get("column_id"):
        column = _owned_column(conn, user, get_column(conn, value["column_id"]))
        if column["board_id"] != existing["board_id"]:
            raise HTTPException(status_code=400, detail="Column is not on this board")

    return update_task(conn, tid, value)


@router.delete("/{task_id}")
@router.delete("/{task_id}/", include_in_schema=False)
def remove(task_id: str, request: Request):
    user = require_user(request)
    tid = _task_id(task_id)
    conn = _db(request)
    require_owned_task(conn, user, tid)
    delete_task(conn, tid)
    return Response(status_code=204)
