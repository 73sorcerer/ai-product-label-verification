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

    def __call__(self, params=None, options=None, *rest):
        if isinstance(params, str):  # positional id, e.g. sessions.expire("cs_1")
            self.calls.append(params)
            return self.result(params) if callable(self.result) else self.result
        self.calls.append(params or {})
        return self.result(params or {}) if callable(self.result) else self.result


class _Obj(dict):
    """Dict that also allows attribute access and to_dict(), like a StripeObject."""

    __getattr__ = dict.get

    def to_dict(self):
        return dict(self)


class FakeStripe:
    """Stands in for StripeClient: only the v1 calls billing uses.

    `subscriptions` holds Stripe's CURRENT state per subscription id (what retrieve() returns),
    so tests can deliver stale webhook snapshots and check the code reconciles to the truth.
    """

    def __init__(self, price_ids=None, subscriptions=None):
        price_ids = price_ids if price_ids is not None else {"professional_monthly": "price_pro_m", "starter_monthly": "price_start_m"}
        self.subscriptions = subscriptions if subscriptions is not None else {}
        self.sessions_created = 0
        fake = self

        def prices(params):
            keys = params.get("lookup_keys", [])
            return _Obj(data=[_Obj(id=price_ids[k]) for k in keys if k in price_ids])

        def create_session(params):
            fake.sessions_created += 1
            n = fake.sessions_created
            return _Obj(id=f"cs_{n}", url=f"https://checkout.stripe.test/c/cs_{n}", expires_at=params.get("expires_at"))

        def retrieve_subscription(sub_id, params=None, options=None):
            fake.retrieve_calls.append(sub_id)
            return _Obj(fake.subscriptions[sub_id])

        self.retrieve_calls = []
        v1 = type("V1", (), {})()
        v1.prices = type("Prices", (), {})()
        v1.prices.list = _Recorder(prices)
        v1.checkout = type("Checkout", (), {})()
        v1.checkout.sessions = type("Sessions", (), {})()
        v1.checkout.sessions.create = _Recorder(create_session)
        v1.checkout.sessions.expire = _Recorder(lambda params: _Obj(status="expired"))
        v1.billing_portal = type("Portal", (), {})()
        v1.billing_portal.sessions = type("Sessions", (), {})()
        v1.billing_portal.sessions.create = _Recorder(_Obj(url="https://billing.stripe.test/p/s_456"))
        v1.subscriptions = type("Subscriptions", (), {})()
        v1.subscriptions.retrieve = retrieve_subscription
        self.v1 = v1


@pytest.fixture
def fake_stripe():
    """Inject a FakeStripe into the billing routes: `stripe = fake_stripe()`."""
    from app import billing

    def install(**kwargs):
        stripe = FakeStripe(**kwargs)
        app.dependency_overrides[billing.get_stripe] = lambda: stripe
        app.dependency_overrides[billing.get_stripe_optional] = lambda: stripe
        return stripe

    yield install
    app.dependency_overrides.clear()
