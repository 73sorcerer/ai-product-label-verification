"""Engine selection in app/database.py.  OWNER: Amzad"""
import pytest

from app import database


@pytest.mark.parametrize(
    "env, expected",
    [
        ("postgres://u:p@host/db", "postgresql+psycopg://u:p@host/db"),  # Neon / Heroku style
        ("postgresql://u:p@host/db?sslmode=require", "postgresql+psycopg://u:p@host/db?sslmode=require"),
        ("postgresql+psycopg://u:p@host/db", "postgresql+psycopg://u:p@host/db"),  # already explicit
        ("sqlite:///./other.db", "sqlite:///./other.db"),
    ],
)
def test_database_url_from_env(monkeypatch, env, expected):
    monkeypatch.setenv("DATABASE_URL", env)
    assert database._database_url() == expected


def test_sqlite_fallback_locally(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.delenv("VERCEL", raising=False)
    assert database._database_url() == "sqlite:///./labelguard.db"


def test_sqlite_fallback_on_vercel_uses_tmp(monkeypatch):
    monkeypatch.delenv("DATABASE_URL", raising=False)
    monkeypatch.setenv("VERCEL", "1")
    assert database._database_url() == "sqlite:////tmp/labelguard.db"


def test_init_db_creates_both_tables():
    from sqlalchemy import inspect

    database.init_db()
    tables = set(inspect(database.engine).get_table_names())
    assert {"product_specs", "inspections"} <= tables
