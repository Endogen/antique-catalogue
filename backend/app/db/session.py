from __future__ import annotations

from collections.abc import Generator
from typing import Any

from sqlalchemy import Engine, create_engine, event
from sqlalchemy.orm import Session, sessionmaker

from app.core.settings import settings


def _get_connect_args(database_url: str) -> dict[str, Any]:
    if database_url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


def enable_sqlite_pragmas(engine: Engine) -> None:
    """Configure SQLite connections for safe concurrent use.

    SQLite ships with foreign-key enforcement disabled, but the schema relies
    on ``ON DELETE CASCADE`` to remove child rows. WAL mode and a busy timeout
    keep concurrent reads/writes from failing with "database is locked".
    """
    if engine.dialect.name != "sqlite":
        return

    @event.listens_for(engine, "connect")
    def _set_sqlite_pragmas(dbapi_connection: Any, _connection_record: Any) -> None:
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.execute("PRAGMA journal_mode=WAL")
        cursor.execute("PRAGMA busy_timeout=5000")
        cursor.close()


engine = create_engine(
    settings.database_url,
    connect_args=_get_connect_args(settings.database_url),
    pool_pre_ping=True,
)
enable_sqlite_pragmas(engine)

SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)


def get_db() -> Generator[Session, None, None]:
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
