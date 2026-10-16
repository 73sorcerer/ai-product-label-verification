"""SQLite engine and session management.

OWNER: Amzad. STUB: working defaults; adjust freely.
"""
import os

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, sessionmaker

def _database_url() -> str:
    """SQLite locally; Neon Postgres when deployed (Vercel sets DATABASE_URL). See docs/deployment.md."""
    url = os.getenv("DATABASE_URL")
    if not url:
        # Vercel's filesystem is read-only except /tmp (and /tmp isn't shared or persistent).
        return "sqlite:////tmp/labelguard.db" if os.getenv("VERCEL") else "sqlite:///./labelguard.db"
    for prefix in ("postgres://", "postgresql://"):
        if url.startswith(prefix):
            return "postgresql+psycopg://" + url[len(prefix):]
    return url


DATABASE_URL = _database_url()

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    pool_pre_ping=True,  # Neon closes idle connections; reconnect instead of erroring
)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


class Base(DeclarativeBase):
    pass


def init_db() -> None:
    from app import models  # noqa: F401  (registers tables on Base.metadata)

    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
