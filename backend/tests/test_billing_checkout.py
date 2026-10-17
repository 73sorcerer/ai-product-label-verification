"""Stripe client guard and POST /billing/checkout (ADR 0003).  OWNER: Amzad (built by Tray, Oct 17)"""
import re

from app import workspace

BODY = {"plan": "professional", "interval": "monthly"}


def test_checkout_returns_stripe_url(client, fake_stripe):
    fake_stripe()
    r = client.post("/billing/checkout", json=BODY)
    assert r.status_code == 200, r.text
    assert r.json() == {"url": "https://checkout.stripe.test/c/s_123"}


def test_checkout_params(client, fake_stripe, monkeypatch):
    stripe = fake_stripe()
    monkeypatch.setenv("PUBLIC_URL", "https://example.test")
    r = client.post("/billing/checkout", json=BODY, headers={"Origin": "https://example.test"})
    assert r.status_code == 200
    [params] = stripe.v1.checkout.sessions.create.calls
    cookie_ws = workspace.verify(client.cookies.get(workspace.COOKIE), "dev-only-secret")
    assert params["mode"] == "subscription"
    assert params["line_items"] == [{"price": "price_pro_m", "quantity": 1}]
    assert params["subscription_data"] == {"trial_period_days": 14}
    assert params["client_reference_id"] == cookie_ws
    assert "payment_method_types" not in params
    assert re.fullmatch(r"labelguard-pricing-[a-z]{8}", params["integration_identifier"])
    assert params["cancel_url"] == "https://example.test/pricing"
    assert params["success_url"] == "https://example.test/billing/success?session_id={CHECKOUT_SESSION_ID}"
    assert stripe.v1.prices.list.calls == [{"lookup_keys": ["professional_monthly"], "active": True}]


def test_checkout_unknown_plan_422(client, fake_stripe):
    fake_stripe()
    assert client.post("/billing/checkout", json={"plan": "gold", "interval": "monthly"}).status_code == 422
    assert client.post("/billing/checkout", json={"plan": "starter", "interval": "weekly"}).status_code == 422


def test_checkout_without_key_503(client, monkeypatch):
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    r = client.post("/billing/checkout", json=BODY)
    assert r.status_code == 503
    assert r.json()["detail"] == "Billing is not configured"


def test_live_key_refused_503(client, monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_live_abc")
    assert client.post("/billing/checkout", json=BODY).status_code == 503


def test_restricted_test_key_accepted(monkeypatch):
    from app import billing
    monkeypatch.setenv("STRIPE_SECRET_KEY", "rk_test_abc")
    assert billing.get_stripe() is not None


def test_plans_still_ok_with_live_key(client, monkeypatch):
    monkeypatch.setenv("STRIPE_SECRET_KEY", "sk_live_abc")
    assert client.get("/plans").status_code == 200


def test_missing_price_502(client, fake_stripe):
    fake_stripe(price_ids={})
    r = client.post("/billing/checkout", json=BODY)
    assert r.status_code == 502
    assert r.json()["detail"] == "Stripe price not found"


def test_untrusted_origin_cannot_redirect_payer(client, fake_stripe, monkeypatch):
    """Security review: the Origin header is caller-controlled; Stripe must never redirect a payer to it."""
    monkeypatch.setenv("PUBLIC_URL", "https://ai-product-label-verification.vercel.app")
    stripe = fake_stripe()
    client.post("/billing/checkout", json=BODY, headers={"Origin": "https://evil.example"})
    [params] = stripe.v1.checkout.sessions.create.calls
    assert params["success_url"].startswith("https://ai-product-label-verification.vercel.app/billing/success")
    assert params["cancel_url"] == "https://ai-product-label-verification.vercel.app/pricing"


def test_allowed_origin_is_used(client, fake_stripe, monkeypatch):
    monkeypatch.setenv("PUBLIC_URL", "https://ai-product-label-verification.vercel.app")
    monkeypatch.setenv("CORS_ORIGINS", "http://localhost:3000")
    stripe = fake_stripe()
    client.post("/billing/checkout", json=BODY, headers={"Origin": "http://localhost:3000"})
    assert stripe.v1.checkout.sessions.create.calls[0]["cancel_url"] == "http://localhost:3000/pricing"


def test_checkout_blocked_when_already_subscribed(client, fake_stripe):
    """A second live subscription would double-bill; send the customer to the portal instead."""
    from app.database import SessionLocal
    from app.models import Subscription
    stripe = fake_stripe()
    client.get("/billing/status")
    ws = workspace.verify(client.cookies.get(workspace.COOKIE), "dev-only-secret")
    with SessionLocal() as db:
        db.add(Subscription(workspace_id=ws, stripe_customer_id="cus_1", stripe_subscription_id="sub_1",
                            status="trialing", payment_failed=False, last_event_created=1))
        db.commit()
    r = client.post("/billing/checkout", json=BODY)
    assert r.status_code == 409
    assert "Manage billing" in r.json()["detail"]
    assert stripe.v1.checkout.sessions.create.calls == []
