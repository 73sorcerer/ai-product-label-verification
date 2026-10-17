"""Plan catalog and GET /plans (ADR 0003).  OWNER: Amzad (built by Tray, Oct 17)"""
import pytest

from app import plans


def test_plans_lists_three_tiers_in_order(client):
    r = client.get("/plans")
    assert r.status_code == 200
    assert [p["id"] for p in r.json()] == ["starter", "professional", "enterprise"]


def test_plan_prices_match_adr(client):
    body = {p["id"]: p for p in client.get("/plans").json()}
    assert (body["starter"]["monthly_cents"], body["starter"]["annual_cents"]) == (4900, 49000)
    assert (body["professional"]["monthly_cents"], body["professional"]["annual_cents"]) == (14900, 149000)
    assert (body["enterprise"]["monthly_cents"], body["enterprise"]["annual_cents"]) == (49900, 499000)


def test_limits_and_trial_match_adr(client):
    body = {p["id"]: p for p in client.get("/plans").json()}
    assert (body["starter"]["inspections_per_month"], body["starter"]["saved_specs"], body["starter"]["history_days"]) == (200, 10, 90)
    assert (body["professional"]["inspections_per_month"], body["professional"]["saved_specs"], body["professional"]["history_days"]) == (1000, None, 365)
    assert all(p["trial_days"] == 14 for p in body.values())


def test_unlimited_is_null(client):
    enterprise = {p["id"]: p for p in client.get("/plans").json()}["enterprise"]
    assert enterprise["inspections_per_month"] is None
    assert enterprise["saved_specs"] is None
    assert enterprise["history_days"] is None


def test_only_professional_is_highlighted(client):
    assert [p["id"] for p in client.get("/plans").json() if p["highlight"]] == ["professional"]


def test_lookup_key():
    assert plans.lookup_key("professional", "annual") == "professional_annual"
    assert plans.lookup_key("starter", "monthly") == "starter_monthly"
    with pytest.raises(KeyError):
        plans.lookup_key("gold", "monthly")
    with pytest.raises(KeyError):
        plans.lookup_key("starter", "weekly")


def test_plans_works_without_stripe_key(client, monkeypatch):
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    assert client.get("/plans").status_code == 200
