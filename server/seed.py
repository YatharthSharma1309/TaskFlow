"""Insert a default board if the database is empty."""


def seed(conn, *, reset: bool = False) -> None:
    if reset:
        conn.execute("DELETE FROM tasks")
        conn.execute("DELETE FROM columns")
        conn.execute("DELETE FROM boards")
        try:
            conn.execute(
                "DELETE FROM sqlite_sequence WHERE name IN ('tasks', 'columns', 'boards')"
            )
        except Exception:
            pass
        conn.commit()

    existing = conn.execute("SELECT COUNT(*) AS n FROM boards").fetchone()["n"]
    if existing > 0:
        return

    with conn:
        cur = conn.execute("INSERT INTO boards (name) VALUES (?)", ("Product Launch",))
        board_id = cur.lastrowid

        todo_id = conn.execute(
            "INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)",
            (board_id, "To Do", 0),
        ).lastrowid
        doing_id = conn.execute(
            "INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)",
            (board_id, "In Progress", 1),
        ).lastrowid
        done_id = conn.execute(
            "INSERT INTO columns (board_id, name, position) VALUES (?, ?, ?)",
            (board_id, "Done", 2),
        ).lastrowid

        tasks = [
            (todo_id, "Write launch blog post", "Outline benefits and include screenshots of the new checkout flow.", "High", 0, "2026-08-12T10:00:00Z"),
            (todo_id, "Design landing page hero", "Need a headline, subcopy, and a single primary CTA.", "Medium", 1, "2026-08-11T15:30:00Z"),
            (todo_id, "Set up analytics events", None, "Low", 2, "2026-08-10T09:00:00Z"),
            (doing_id, "Implement checkout flow", "Card payment first; Apple Pay can wait.", "High", 0, "2026-08-13T08:15:00Z"),
            (doing_id, "Fix mobile nav overlap", "Hamburger menu sits under the cookie banner on iPhone SE.", "Medium", 1, "2026-08-09T18:45:00Z"),
            (done_id, "Choose color palette", "Settled on navy + amber after the last design review.", "Medium", 0, "2026-08-08T12:00:00Z"),
            (done_id, "Draft press release", None, "Low", 1, "2026-08-07T16:20:00Z"),
        ]
        conn.executemany(
            """
            INSERT INTO tasks (column_id, title, description, priority, position, created_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            tasks,
        )
