"""Stripe client guard and POST /billing/checkout (ADR 0003).  OWNER: Amzad (built by Tray, Oct 17)"""
import re

from app import workspace

BODY = {"plan": "professional", "interval": "monthly"}


def test_checkout_returns_stripe_url(client, fake_stripe):
    fake_stripe()
    r = client.post("/billing/checkout", json=BODY)
    assert r.status_code == 200, r.text
    assert r.json() == {"url": "https://checkout.stripe.test/c/s_123"}


def test_checkout_params(client, fake_stripe):
    stripe = fake_stripe()
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
