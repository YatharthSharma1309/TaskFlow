from pathlib import Path
import sqlite3

from seed import seed

SCHEMA_PATH = Path(__file__).resolve().parent / "schema.sql"


def default_db_path() -> Path:
    data_dir = Path(__file__).resolve().parent / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    return data_dir / "taskflow.db"


def create_database(db_path: str | Path | None = None) -> sqlite3.Connection:
    if db_path is None:
        db_path = default_db_path()

    if db_path != ":memory:":
        Path(db_path).parent.mkdir(parents=True, exist_ok=True)

    conn = sqlite3.connect(db_path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute("PRAGMA journal_mode = WAL")
    conn.executescript(SCHEMA_PATH.read_text(encoding="utf-8"))
    seed(conn)
    return conn
