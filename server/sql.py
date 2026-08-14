"""Tiny DB wrapper so queries.py can stay on `?` placeholders.

SQLite is the local/test default. Postgres is used when DATABASE_URL is set.
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


def _is_disconnect(exc: BaseException) -> bool:
    name = type(exc).__name__
    if name in {"OperationalError", "InterfaceError"}:
        return True
    message = str(exc).lower()
    return "ssl connection has been closed" in message or "connection is closed" in message or "server closed" in message


class Database:
    def __init__(self, inner, dialect: str, reconnect=None):
        self._inner = inner
        self.dialect = dialect
        self._reconnect = reconnect
        self._lock = threading.Lock()

    def execute(self, sql, params=()):
        return self._call(lambda conn: conn.execute(self._prep(sql), params))

    def executemany(self, sql, seq):
        def run(conn):
            prepared = self._prep(sql)
            if self.dialect == "postgres":
                with conn.cursor() as cur:
                    cur.executemany(prepared, seq)
                    return cur
            return conn.executemany(prepared, seq)

        return self._call(run)

    def insert_id(self, sql, params=()):
        def run(conn):
            if self.dialect == "postgres":
                prepared = self._prep(sql).rstrip().rstrip(";") + " RETURNING id"
                row = conn.execute(prepared, params).fetchone()
                return row["id"]
            cur = conn.execute(sql, params)
            return cur.lastrowid

        return self._call(run)

    def commit(self):
        self._call(lambda conn: conn.commit())

    def rollback(self):
        try:
            self._call(lambda conn: conn.rollback())
        except Exception:
            pass

    def close(self):
        with self._lock:
            try:
                self._inner.close()
            except Exception:
                pass

    def _call(self, fn):
        with self._lock:
            try:
                return fn(self._inner)
            except Exception as exc:
                if self.dialect != "postgres" or not self._reconnect or not _is_disconnect(exc):
                    raise
                try:
                    self._inner.close()
                except Exception:
                    pass
                self._inner = self._reconnect()
                return fn(self._inner)

    def _prep(self, sql: str) -> str:
        if self.dialect == "postgres":
            return sql.replace("?", "%s")
        return sql


def purge_expired_sessions(conn: Database) -> None:
    conn.execute("DELETE FROM sessions WHERE expires_at <= ?", (utc_now(),))
    conn.commit()
