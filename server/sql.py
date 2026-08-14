"""Tiny DB wrapper so queries.py can stay on `?` placeholders.

SQLite is the local/test default. Postgres (Neon) is used when DATABASE_URL is set.
"""

from __future__ import annotations

import sqlite3
import threading
from datetime import datetime, timezone


def utc_now() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def unique_errors() -> tuple[type[Exception], ...]:
    errors: list[type[Exception]] = [sqlite3.IntegrityError]
    try:
        from psycopg.errors import UniqueViolation

        errors.append(UniqueViolation)
    except ImportError:
        pass
    return tuple(errors)


class Database:
    def __init__(self, inner, dialect: str):
        self._inner = inner
        self.dialect = dialect
        self._lock = threading.Lock()

    def execute(self, sql, params=()):
        with self._lock:
            return self._inner.execute(self._prep(sql), params)

    def executemany(self, sql, seq):
        with self._lock:
            prepared = self._prep(sql)
            if self.dialect == "postgres":
                with self._inner.cursor() as cur:
                    cur.executemany(prepared, seq)
                    return cur
            return self._inner.executemany(prepared, seq)

    def insert_id(self, sql, params=()):
        with self._lock:
            if self.dialect == "postgres":
                prepared = self._prep(sql).rstrip().rstrip(";") + " RETURNING id"
                row = self._inner.execute(prepared, params).fetchone()
                return row["id"]
            cur = self._inner.execute(sql, params)
            return cur.lastrowid

    def commit(self):
        with self._lock:
            self._inner.commit()

    def rollback(self):
        with self._lock:
            self._inner.rollback()

    def close(self):
        with self._lock:
            self._inner.close()

    def _prep(self, sql: str) -> str:
        if self.dialect == "postgres":
            return sql.replace("?", "%s")
        return sql


def purge_expired_sessions(conn: Database) -> None:
    conn.execute("DELETE FROM sessions WHERE expires_at <= ?", (utc_now(),))
    conn.commit()
