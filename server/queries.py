"""All database access. The two assignment queries are
count_tasks_per_column and list_tasks_by_priority."""


def _rows(cursor):
    return [dict(row) for row in cursor.fetchall()]


def _row(cursor):
    result = cursor.fetchone()
    return dict(result) if result is not None else None


def get_board(conn, board_id):
    return _row(conn.execute(
        "SELECT id, name, created_at FROM boards WHERE id = ?",
        (board_id,),
    ))


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
          c.name AS column_name
        FROM tasks t
        INNER JOIN columns c ON c.id = t.column_id
        WHERE t.id = ?
        """,
        (task_id,),
    ))


def get_column(conn, column_id):
    return _row(conn.execute(
        "SELECT id, board_id, name, position FROM columns WHERE id = ?",
        (column_id,),
    ))


def create_task(conn, *, column_id, title, description, priority):
    next_pos = conn.execute(
        "SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM tasks WHERE column_id = ?",
        (column_id,),
    ).fetchone()["next_pos"]

    cur = conn.execute(
        """
        INSERT INTO tasks (column_id, title, description, priority, position)
        VALUES (?, ?, ?, ?, ?)
        """,
        (column_id, title, description, priority, next_pos),
    )
    conn.commit()
    return get_task(conn, cur.lastrowid)


def update_task(conn, task_id, fields):
    column_id = fields.get("column_id")
    sets = []
    params = []
    for key in ("title", "description", "priority"):
        if key in fields:
            sets.append(f"{key} = ?")
            params.append(fields[key])

    with conn:
        if sets:
            params.append(task_id)
            conn.execute(f"UPDATE tasks SET {', '.join(sets)} WHERE id = ?", params)
        if column_id:
            next_pos = conn.execute(
                "SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM tasks WHERE column_id = ?",
                (column_id,),
            ).fetchone()["next_pos"]
            conn.execute(
                "UPDATE tasks SET column_id = ?, position = ? WHERE id = ?",
                (column_id, next_pos, task_id),
            )

    return get_task(conn, task_id)


def move_task(conn, task_id, column_id):
    next_pos = conn.execute(
        "SELECT COALESCE(MAX(position), -1) + 1 AS next_pos FROM tasks WHERE column_id = ?",
        (column_id,),
    ).fetchone()["next_pos"]

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
