"""All database access. The two assignment queries are
count_tasks_per_column and list_tasks_by_priority."""

from sql import utc_now


def _rows(cursor):
    return [dict(row) for row in cursor.fetchall()]


def _row(cursor):
    result = cursor.fetchone()
    return dict(result) if result is not None else None


def get_user_by_email(conn, email):
    return _row(conn.execute(
        "SELECT id, email, password_hash, created_at FROM users WHERE email = ?",
        (email,),
    ))


def get_user_by_id(conn, user_id):
    return _row(conn.execute(
        "SELECT id, email, created_at FROM users WHERE id = ?",
        (user_id,),
    ))


def create_user(conn, *, email, password_hash):
    user_id = conn.insert_id(
        "INSERT INTO users (email, password_hash) VALUES (?, ?)",
        (email, password_hash),
    )
    conn.commit()
    return get_user_by_id(conn, user_id)


def create_session(conn, token, user_id, expires_at):
    conn.execute(
        "INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)",
        (token, user_id, expires_at),
    )
    conn.commit()


def delete_session(conn, token):
    conn.execute("DELETE FROM sessions WHERE token = ?", (token,))
    conn.commit()


def get_session_user(conn, token):
    return _row(conn.execute(
        """
        SELECT u.id, u.email, u.created_at
        FROM sessions s
        INNER JOIN users u ON u.id = s.user_id
        WHERE s.token = ?
          AND s.expires_at > ?
        """,
        (token, utc_now()),
    ))


def get_board(conn, board_id):
    return _row(conn.execute(
        "SELECT id, user_id, name, created_at FROM boards WHERE id = ?",
        (board_id,),
    ))


def get_board_for_user(conn, user_id):
    return _row(conn.execute(
        "SELECT id, user_id, name, created_at FROM boards WHERE user_id = ?",
        (user_id,),
    ))


def create_board(conn, *, user_id, name):
    board_id = conn.insert_id(
        "INSERT INTO boards (user_id, name) VALUES (?, ?)",
        (user_id, name),
    )
    conn.commit()
    return get_board(conn, board_id)


def list_columns(conn, board_id):
    return _rows(conn.execute(
        """
        SELECT id, board_id, name, position
        FROM columns
        WHERE board_id = ?
        ORDER BY position ASC
        """,
        (board_id,),
    ))


def count_tasks_per_column(conn, board_id):
    """Required query 1 — count of tasks per column on a board.
    LEFT JOIN so empty columns still appear with a count of 0."""
    return _rows(conn.execute(
        """
        SELECT
          c.id,
          c.name,
          c.position,
          COUNT(t.id) AS task_count
        FROM columns c
        LEFT JOIN tasks t ON t.column_id = c.id
        WHERE c.board_id = ?
        GROUP BY c.id, c.name, c.position
        ORDER BY c.position ASC
        """,
        (board_id,),
    ))


def list_tasks_by_priority(conn, board_id, priority):
    """Required query 2 — tasks with a given priority, newest first."""
    return _rows(conn.execute(
        """
        SELECT
          t.id,
          t.column_id,
          t.title,
          t.description,
          t.priority,
          t.position,
          t.created_at,
          c.name AS column_name
        FROM tasks t
        INNER JOIN columns c ON c.id = t.column_id
        WHERE c.board_id = ?
          AND t.priority = ?
        ORDER BY t.created_at DESC, t.id DESC
        """,
        (board_id, priority),
    ))


def list_tasks_for_board(conn, board_id, *, priority=None, q=None):
    """Tasks on a board, with optional priority + title filters applied in SQL."""
    clauses = ["c.board_id = ?"]
    params = [board_id]

    if priority:
        clauses.append("t.priority = ?")
        params.append(priority)

    if q:
        clauses.append("t.title LIKE ? ESCAPE '\\'")
        params.append(f"%{_escape_like(q)}%")

    sql = f"""
        SELECT
          t.id,
          t.column_id,
          t.title,
          t.description,
          t.priority,
          t.position,
          t.created_at
        FROM tasks t
        INNER JOIN columns c ON c.id = t.column_id
        WHERE {' AND '.join(clauses)}
        ORDER BY t.position ASC, t.id ASC
    """
    return _rows(conn.execute(sql, params))


def get_task(conn, task_id):
    return _row(conn.execute(
        """
        SELECT
          t.id,
          t.column_id,
          t.title,
          t.description,
          t.priority,
          t.position,
          t.created_at,
          c.board_id,
          c.name AS column_name,
          b.user_id
        FROM tasks t
        INNER JOIN columns c ON c.id = t.column_id
        INNER JOIN boards b ON b.id = c.board_id
        WHERE t.id = ?
        """,
        (task_id,),
    ))


def get_column(conn, column_id):
    return _row(conn.execute(
        "SELECT id, board_id, name, position FROM columns WHERE id = ?",
        (column_id,),
    ))


def _next_position(conn, column_id, exclude_task_id=None):
    if exclude_task_id is None:
        row = conn.execute(
            "SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM tasks WHERE column_id = ?",
            (column_id,),
        ).fetchone()
    else:
        row = conn.execute(
            """
            SELECT COALESCE(MAX(position), -1) + 1 AS next_pos
            FROM tasks
            WHERE column_id = ? AND id != ?
            """,
            (column_id, exclude_task_id),
        ).fetchone()
    return row["next_pos"]


def create_task(conn, *, column_id, title, description, priority):
    next_pos = _next_position(conn, column_id)

    task_id = conn.insert_id(
        """
        INSERT INTO tasks (column_id, title, description, priority, position)
        VALUES (?, ?, ?, ?, ?)
        """,
        (column_id, title, description, priority, next_pos),
    )
    conn.commit()
    return get_task(conn, task_id)


def update_task(conn, task_id, fields):
    existing = get_task(conn, task_id)
    column_id = fields.get("column_id")
    moving = existing is not None and column_id is not None and column_id != existing["column_id"]

    sets = []
    params = []
    for key in ("title", "description", "priority"):
        if key in fields:
            sets.append(f"{key} = ?")
            params.append(fields[key])

    try:
        if sets:
            params.append(task_id)
            conn.execute(f"UPDATE tasks SET {', '.join(sets)} WHERE id = ?", params)
        if moving:
            next_pos = _next_position(conn, column_id, exclude_task_id=task_id)
            conn.execute(
                "UPDATE tasks SET column_id = ?, position = ? WHERE id = ?",
                (column_id, next_pos, task_id),
            )
        conn.commit()
    except Exception:
        conn.rollback()
        raise

    return get_task(conn, task_id)


def move_task(conn, task_id, column_id):
    existing = get_task(conn, task_id)
    if existing and existing["column_id"] == column_id:
        return existing

    next_pos = _next_position(conn, column_id, exclude_task_id=task_id)
    conn.execute(
        "UPDATE tasks SET column_id = ?, position = ? WHERE id = ?",
        (column_id, next_pos, task_id),
    )
    conn.commit()
    return get_task(conn, task_id)


def delete_task(conn, task_id):
    conn.execute("DELETE FROM tasks WHERE id = ?", (task_id,))
    conn.commit()


def _escape_like(value: str) -> str:
    return value.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
