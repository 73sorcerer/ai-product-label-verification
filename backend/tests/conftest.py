import os
import tempfile
from pathlib import Path

# Must be set before app.database is imported: the engine is built at import time.
# A throwaway SQLite file per run, so tests never touch labelguard.db or a real Postgres.
# Set TEST_DATABASE_URL to run against a disposable Postgres instead (tables are dropped per test):
#   TEST_DATABASE_URL=postgresql://postgres:test@localhost:55432/labelguard pytest
_TMP = Path(tempfile.mkdtemp(prefix="labelguard-test-"))
os.environ["DATABASE_URL"] = os.getenv("TEST_DATABASE_URL") or f"sqlite:///{_TMP / 'test.db'}"

import pytest
from fastapi.testclient import TestClient

from app import ocr
from app.database import Base, engine
from app.main import app

SAMPLES = Path(__file__).resolve().parents[2] / "data" / "sample_labels"


@pytest.fixture
def client():
    Base.metadata.drop_all(bind=engine)  # every test starts with empty tables
    with TestClient(app) as c:  # startup runs init_db(), which recreates them
        yield c


@pytest.fixture
def fake_ocr(monkeypatch):
    """Replace the OCR engine with canned lines: fake_ocr([("Sunrise Farms", 0.99), ...]).

    Lets API tests pick exact text and confidence without depending on what the real engine reads.
    Returns a list that records each call's image bytes.
    """
    calls = []

    def install(lines: list[tuple[str, float]]):
        def extract_text(image_bytes: bytes) -> ocr.OcrResult:
            calls.append(image_bytes)
            ocr_lines = [ocr.OcrLine(t, c, (0, i * 40, 100, 30)) for i, (t, c) in enumerate(lines)]
            return ocr.build_result(ocr_lines, "fake")

        monkeypatch.setattr(ocr, "extract_text", extract_text)
        return calls

    return install
