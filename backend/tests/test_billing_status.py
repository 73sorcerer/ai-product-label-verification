"""GET /billing/status and POST /billing/portal (ADR 0003/0004).  OWNER: Amzad (built by Tray, Oct 17)"""
from datetime import datetime, timezone

from app import workspace
from app.database import SessionLocal
from app.models import Subscription

DEV = "dev-only-secret"
EMPTY = {"plan": None, "interval": None, "status": None, "trial_end": None, "current_period_end": None, "payment_failed": False}


def my_workspace(client) -> str:
    client.get("/billing/status")  # first call sets the cookie
    return workspace.verify(client.cookies.get(workspace.COOKIE), DEV)


def add_subscription(workspace_id: str, customer="cus_A", **kw):
    with SessionLocal() as db:
        db.add(Subscription(workspace_id=workspace_id, stripe_customer_id=customer, stripe_subscription_id=f"sub_{workspace_id}",
                            plan=kw.get("plan", "professional"), billing_interval="monthly", status=kw.get("status", "trialing"),
                            trial_end=datetime(2026, 10, 31, tzinfo=timezone.utc), payment_failed=kw.get("payment_failed", False),
                            last_event_created=1))
        db.commit()


def test_status_before_webhook_is_empty_not_error(client):
    r = client.get("/billing/status")
    assert r.status_code == 200
    assert r.json() == EMPTY


def test_status_after_webhook(client):
    add_subscription(my_workspace(client), payment_failed=True)
    body = client.get("/billing/status").json()
    assert (body["plan"], body["interval"], body["status"], body["payment_failed"]) == ("professional", "monthly", "trialing", True)
    assert body["trial_end"].startswith("2026-10-31T00:00:00")


def test_status_ignores_other_workspaces(client):
    add_subscription("someone_else")
    assert client.get("/billing/status").json() == EMPTY


def test_status_works_without_stripe_key(client, monkeypatch):
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    assert client.get("/billing/status").status_code == 200


def test_portal_without_subscription_404(client, fake_stripe):
    fake_stripe()
    r = client.post("/billing/portal")
    assert r.status_code == 404
    assert r.json()["detail"] == "No subscription for this workspace"


def test_portal_returns_url_for_own_customer(client, fake_stripe, monkeypatch):
    monkeypatch.setenv("PUBLIC_URL", "https://example.test")
    stripe = fake_stripe()
    add_subscription(my_workspace(client), customer="cus_mine")
    r = client.post("/billing/portal")
    assert r.status_code == 200
    assert r.json() == {"url": "https://billing.stripe.test/p/s_456"}
    assert stripe.v1.billing_portal.sessions.create.calls == [{"customer": "cus_mine", "return_url": "https://example.test/pricing"}]


def test_tampered_cookie_cannot_open_other_portal(client, fake_stripe):
    fake_stripe()
    add_subscription("victim", customer="cus_victim")
    client.cookies.set(workspace.COOKIE, "victim." + "0" * 64)
    r = client.post("/billing/portal")
    assert r.status_code == 404
    assert workspace.COOKIE in r.headers.get("set-cookie", "")  # a fresh workspace instead


def test_portal_not_configured_503(client, monkeypatch):
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    assert client.post("/billing/portal").status_code == 503
