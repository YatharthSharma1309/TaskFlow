"""Insert a demo account and board if the database is empty."""

from auth import hash_password
from queries import create_board, create_user

DEMO_EMAIL = "demo@taskflow.app"
DEMO_PASSWORD = "demo1234"


def seed(conn, *, reset: bool = False) -> None:
    if reset:
        _clear(conn)

    existing = conn.execute("SELECT COUNT(*) AS n FROM users").fetchone()["n"]
    if existing > 0:
        _repair_empty_boards(conn)
        return

    user = create_user(
        conn,
        email=DEMO_EMAIL,
        password_hash=hash_password(DEMO_PASSWORD),
    )
    seed_board_for_user(conn, user["id"], sample_tasks=True)
    conn.commit()


def seed_board_for_user(conn, user_id: int, *, sample_tasks: bool = False) -> int:
    board = create_board(conn, user_id=user_id, name="Main")
    return _insert_columns(conn, board["id"], sample_tasks=sample_tasks)


def _repair_empty_boards(conn) -> None:
    """Finish a board that was committed before column insert failed."""
    rows = conn.execute(
        """
        SELECT b.id, u.email
        FROM boards b
        INNER JOIN users u ON u.id = b.user_id
        LEFT JOIN columns c ON c.board_id = b.id
        GROUP BY b.id, u.email
        HAVING COUNT(c.id) = 0
        """
    ).fetchall()
    for row in rows:
        board = dict(row)
        _insert_columns(conn, board["id"], sample_tasks=board["email"] == DEMO_EMAIL)


def _insert_columns(conn, board_id: int, *, sample_tasks: bool) -> int:
    todo_id = conn.insert_id(
        "INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)",
        (board_id, "Ready", 0),
    )
    doing_id = conn.insert_id(
        "INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)",
        (board_id, "In Progress", 1),
    )
    done_id = conn.insert_id(
        "INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)",
        (board_id, "Done", 2),
    )

    if not sample_tasks:
        conn.commit()
        return board_id

    tasks = [
        (todo_id, "Write launch blog post", "Cover the hero promise, key benefits, and screenshots of the new checkout. Pair it with the email announcement sequence.", "High", 0, "2026-08-12T10:00:00Z"),
        (todo_id, "Design landing page hero", "Headline, supporting subcopy, one primary CTA, and a slot for social proof (demo clip or screenshot).", "Medium", 1, "2026-08-11T15:30:00Z"),
        (todo_id, "Set up analytics events", "Instrument signup, CTA clicks, add-to-cart, and checkout drop-off. Validate UTM parameters on staging before launch day.", "Low", 2, "2026-08-10T09:00:00Z"),
        (doing_id, "Implement checkout flow", "Card payment first; Apple Pay can wait. Test a successful charge, a declined card, and the confirmation email.", "High", 0, "2026-08-13T08:15:00Z"),
        (doing_id, "Fix mobile nav overlap", "Hamburger menu sits under the cookie banner on iPhone SE. Check 375px width and the sticky header.", "Medium", 1, "2026-08-09T18:45:00Z"),
        (done_id, "Choose color palette", "Settled on navy + amber after the last design review. Use navy for chrome, amber for the primary CTA.", "Medium", 0, "2026-08-08T12:00:00Z"),
        (done_id, "Draft press release", "One-liner, embargo date, founder quote, and a short press-kit link list for journalists.", "Low", 1, "2026-08-07T16:20:00Z"),
    ]
    conn.executemany(
        """
        INSERT INTO tasks (column_id, title, description, priority, position, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        tasks,
    )
    conn.commit()
    return board_id


def _clear(conn) -> None:
    if getattr(conn, "dialect", "sqlite") == "postgres":
        conn.execute("TRUNCATE TABLE sessions, tasks, columns, boards, users RESTART IDENTITY CASCADE")
        conn.commit()
        return

    conn.execute("DELETE FROM sessions")
    conn.execute("DELETE FROM tasks")
    conn.execute("DELETE FROM columns")
    conn.execute("DELETE FROM boards")
    conn.execute("DELETE FROM users")
    if conn.execute(
        "SELECT 1 FROM sqlite_master WHERE type='table' AND name='sqlite_sequence'"
    ).fetchone():
        conn.execute(
            "DELETE FROM sqlite_sequence WHERE name IN "
            "('tasks', 'columns', 'boards', 'users')"
        )
    conn.commit()
