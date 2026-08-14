from typing import Any

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from queries import create_task, delete_task, get_column, get_task, move_task, update_task
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


def _column_on_board(column, board_id: int):
    if not column:
        raise HTTPException(status_code=400, detail="Column not found")
    if column["board_id"] != board_id:
        raise HTTPException(status_code=400, detail="Column is not on this board")


@router.post("", status_code=201)
def create(request: Request, body: dict[str, Any]):
    errors, value = validate_create(body)
    if errors:
        raise HTTPException(status_code=400, detail=errors[0])

    conn = _db(request)
    if not get_column(conn, value["column_id"]):
        raise HTTPException(status_code=400, detail="Column not found")

    return create_task(conn, **value)


@router.patch("/{task_id}/move")
def move(task_id: str, request: Request, body: dict[str, Any]):
    tid = _task_id(task_id)
    conn = _db(request)
    existing = get_task(conn, tid)
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")

    errors, value = validate_move(body)
    if errors:
        raise HTTPException(status_code=400, detail=errors[0])
    _column_on_board(get_column(conn, value["column_id"]), existing["board_id"])

    return move_task(conn, tid, value["column_id"])


@router.patch("/{task_id}")
def update(task_id: str, request: Request, body: dict[str, Any]):
    tid = _task_id(task_id)
    conn = _db(request)
    existing = get_task(conn, tid)
    if not existing:
        raise HTTPException(status_code=404, detail="Task not found")

    errors, value = validate_update(body)
    if errors:
        raise HTTPException(status_code=400, detail=errors[0])

    if value.get("column_id"):
        _column_on_board(get_column(conn, value["column_id"]), existing["board_id"])

    return update_task(conn, tid, value)


@router.delete("/{task_id}")
def remove(task_id: str, request: Request):
    tid = _task_id(task_id)
    conn = _db(request)
    if not get_task(conn, tid):
        raise HTTPException(status_code=404, detail="Task not found")
    delete_task(conn, tid)
    return Response(status_code=204)
