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


class _Recorder:
    """Records the params of each call and returns a canned object."""

    def __init__(self, result):
        self.result, self.calls = result, []

    def __call__(self, params=None, options=None):
        self.calls.append(params or {})
        return self.result(params or {}) if callable(self.result) else self.result


class FakeStripe:
    """Stands in for StripeClient: only the v1 calls billing uses."""

    def __init__(self, price_ids=None):
        price_ids = price_ids if price_ids is not None else {"professional_monthly": "price_pro_m"}

        def prices(params):
            keys = params.get("lookup_keys", [])
            return type("L", (), {"data": [type("P", (), {"id": price_ids[k]})() for k in keys if k in price_ids]})()

        v1 = type("V1", (), {})()
        v1.prices = type("Prices", (), {})()
        v1.prices.list = _Recorder(prices)
        v1.checkout = type("Checkout", (), {})()
        v1.checkout.sessions = type("Sessions", (), {})()
        v1.checkout.sessions.create = _Recorder(type("S", (), {"url": "https://checkout.stripe.test/c/s_123"})())
        v1.billing_portal = type("Portal", (), {})()
        v1.billing_portal.sessions = type("Sessions", (), {})()
        v1.billing_portal.sessions.create = _Recorder(type("S", (), {"url": "https://billing.stripe.test/p/s_456"})())
        self.v1 = v1


@pytest.fixture
def fake_stripe():
    """Inject a FakeStripe into the billing routes: `stripe = fake_stripe()`."""
    from app import billing

    def install(**kwargs):
        stripe = FakeStripe(**kwargs)
        app.dependency_overrides[billing.get_stripe] = lambda: stripe
        return stripe

    yield install
    app.dependency_overrides.clear()
