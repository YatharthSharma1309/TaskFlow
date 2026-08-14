from pathlib import Path
import os
import sqlite3

from seed import seed
from sql import Database, purge_expired_sessions

SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"
POSTGRES_SCHEMA_PATH = Path(__file__).resolve().parent / "schema.postgres.sql"


def _load_dotenv() -> None:
    path = Path(__file__).resolve().parent.parent / ".env"
    if not path.is_file():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, _, value = stripped.partition("=")
        key = key.strip()
        value = value.strip().strip("'").strip('"')
        if key:
            os.environ.setdefault(key, value)


def default_db_path() -> Path:
    data_dir = Path(__file__).resolve().parent / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "taskflow.db"


def database_url() -> str:
    _load_dotenv()
    return os.environ.get("DATABASE_URL", "").strip()


def connect(db_path: str | Path | None = None) -> Database:
    url = database_url()
    if url.startswith("postgres"):
        return create_postgres(url)
    return create_database(db_path)


def create_database(db_path: str | Path | None = None) -> Database:
    if db_path is None:
        db_path = os.environ.get("TASKFLOW_DB_PATH") or default_db_path()

    if db_path != ":memory:":
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    raw = sqlite3.connect(db_path, check_same_thread=False)
    raw.row_factory = sqlite3.Row
    raw.execute("PRAGMA foreign_keys = ON")
    raw.execute("PRAGMA journal_mode = WAL")
    raw.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    conn = Database(raw, "sqlite")
    _migrate_sqlite(conn)
    seed(conn)
    purge_expired_sessions(conn)
    return conn


def create_postgres(url: str) -> Database:
    import psycopg
    from psycopg.rows import dict_row

    def open_conn():
        return psycopg.connect(
            url,
            row_factory=dict_row,
            keepalives=1,
            keepalives_idle=30,
            keepalives_interval=10,
            keepalives_count=3,
        )

    conn = Database(open_conn(), "postgres", reconnect=open_conn)
    _run_statements(conn, POSTGRES_SCHEMA_PATH.read_text(encoding="utf-8"))
    seed(conn)
    purge_expired_sessions(conn)
    return conn


def _run_statements(conn: Database, script: str) -> None:
    for chunk in script.split(";"):
        lines = [
            line for line in chunk.splitlines()
            if line.strip() and not line.strip().startswith("--")
        ]
        statement = "\n".join(lines).strip()
        if statement:
            conn.execute(statement)
    conn.commit()


def _migrate_sqlite(conn: Database) -> None:
    """Add user_id to boards created before auth existed, then attach them to a user."""
    columns = [row[1] for row in conn.execute("PRAGMA table_info(boards)")]
    if "user_id" not in columns:
        conn.execute("ALTER TABLE boards ADD COLUMN user_id INTEGER")
        conn.commit()

    orphans = conn.execute(
        "SELECT COUNT(*) AS n FROM boards WHERE user_id IS NULL"
    ).fetchone()["n"]
    if orphans == 0:
        return

    from auth import hash_password
    from seed import DEMO_EMAIL, DEMO_PASSWORD

    demo = conn.execute(
        "SELECT id FROM users WHERE email = ?", (DEMO_EMAIL,)
    ).fetchone()
    if demo is None:
        conn.execute(
            "INSERT INTO users (email, password_hash) VALUES (?, ?)",
            (DEMO_EMAIL, hash_password(DEMO_PASSWORD)),
        )
        demo_id = conn.execute(
            "SELECT id FROM users WHERE email = ?", (DEMO_EMAIL,)
        ).fetchone()["id"]
    else:
        demo_id = demo["id"]

    conn.execute("UPDATE boards SET user_id = ? WHERE user_id IS NULL", (demo_id,))
    conn.commit()
