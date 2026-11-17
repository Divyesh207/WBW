"""SQLite persistence (SQLAlchemy). Override the location with WBW_DATABASE_URL."""
from __future__ import annotations

import os
from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker
from sqlalchemy.pool import StaticPool

DEFAULT_PATH = Path(__file__).resolve().parent / "wbw.db"
DATABASE_URL = os.getenv("WBW_DATABASE_URL", f"sqlite:///{DEFAULT_PATH.as_posix()}")

_kwargs: dict = {"connect_args": {"check_same_thread": False}}
if DATABASE_URL.endswith(":memory:") or DATABASE_URL == "sqlite://":
    _kwargs["poolclass"] = StaticPool  # one shared in-memory database (used by tests)

engine = create_engine(DATABASE_URL, **_kwargs)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    from app.models import assessment  # noqa: F401  (registers the table)

    Base.metadata.create_all(engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
