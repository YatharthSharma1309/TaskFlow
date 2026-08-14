from fastapi import APIRouter, HTTPException, Query, Request

from auth import require_board, require_user
from queries import (
    count_tasks_per_column,
    list_columns,
    list_tasks_by_priority,
    list_tasks_for_board,
)
from validation import parse_optional_priority

router = APIRouter()


def _db(request: Request):
    return request.app.state.db


def _board_id(raw: str) -> int:
    try:
        value = int(raw)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid board id")
    if value < 1:
        raise HTTPException(status_code=400, detail="Invalid board id")
    return value


@router.get("/{board_id}/task-counts")
def task_counts(board_id: str, request: Request):
    user = require_user(request)
    bid = _board_id(board_id)
    conn = _db(request)
    require_board(conn, user, bid)
    return count_tasks_per_column(conn, bid)


@router.get("/{board_id}/tasks")
def tasks_by_priority(
    board_id: str,
    request: Request,
    priority: str | None = Query(default=None),
):
    user = require_user(request)
    bid = _board_id(board_id)
    conn = _db(request)
    require_board(conn, user, bid)

    parsed, err = parse_optional_priority(priority)
    if err:
        raise HTTPException(status_code=400, detail=err)
    if not parsed:
        raise HTTPException(
            status_code=400,
            detail="priority query param is required (Low, Medium, or High)",
        )
    return list_tasks_by_priority(conn, bid, parsed)


@router.get("/{board_id}")
def get_board_payload(
    board_id: str,
    request: Request,
    priority: str | None = Query(default=None),
    q: str | None = Query(default=None),
):
    user = require_user(request)
    bid = _board_id(board_id)
    conn = _db(request)
    board = require_board(conn, user, bid)

    parsed, err = parse_optional_priority(priority)
    if err:
        raise HTTPException(status_code=400, detail=err)

    search = q.strip() if isinstance(q, str) else ""
    columns = list_columns(conn, bid)
    tasks = list_tasks_for_board(conn, bid, priority=parsed, q=search or None)
    counts = count_tasks_per_column(conn, bid)
    count_by_id = {row["id"]: row["task_count"] for row in counts}

    board["columns"] = [
        {
            **column,
            "task_count": count_by_id.get(column["id"], 0),
            "tasks": [task for task in tasks if task["column_id"] == column["id"]],
        }
        for column in columns
    ]
    return board
