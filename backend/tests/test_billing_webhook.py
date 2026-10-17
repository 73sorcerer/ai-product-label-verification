"""POST /billing/webhook: signature, idempotency, ordering (ADR 0003).  OWNER: Amzad (built by Tray, Oct 17)"""
import hashlib
import hmac
import json
import time

import pytest

from app.database import SessionLocal
from app.models import Subscription

SECRET = "whsec_test"


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", SECRET)


def send(client, event: dict, secret: str = SECRET, signature: str | None = None):
    body = json.dumps(event)
    ts = int(time.time())
    sig = hmac.new(secret.encode(), f"{ts}.{body}".encode(), hashlib.sha256).hexdigest()
    headers = {"Content-Type": "application/json"}
    if signature is not False:
        headers["Stripe-Signature"] = signature or f"t={ts},v1={sig}"
    return client.post("/billing/webhook", content=body, headers=headers)


def event(type_: str, obj: dict, id_: str = "evt_1", created: int = 100):
    return {"id": id_, "object": "event", "type": type_, "created": created, "data": {"object": obj}}


def subscription(status="trialing", key="professional_monthly", sub_id="sub_1", trial_end=1_900_000_000):
    return {
        "id": sub_id, "object": "subscription", "customer": "cus_1", "status": status, "trial_end": trial_end,
        "items": {"data": [{"price": {"lookup_key": key}, "current_period_end": 1_900_000_000}]},
    }


def checkout_completed(sub_id="sub_1", workspace="ws_A"):
    return {"id": "cs_1", "object": "checkout.session", "mode": "subscription",
            "subscription": sub_id, "customer": "cus_1", "client_reference_id": workspace}


def rows():
    with SessionLocal() as db:
        return db.query(Subscription).all()


def test_bad_signature_400(client):
    assert send(client, event("customer.subscription.created", subscription()), secret="whsec_wrong").status_code == 400
    assert rows() == []


def test_missing_signature_400(client):
    assert send(client, event("customer.subscription.created", subscription()), signature=False).status_code == 400


def test_checkout_completed_links_workspace(client):
    assert send(client, event("checkout.session.completed", checkout_completed())).status_code == 200
    [row] = rows()
    assert (row.workspace_id, row.stripe_customer_id, row.stripe_subscription_id) == ("ws_A", "cus_1", "sub_1")


def test_subscription_created_sets_plan_status_trial(client):
    send(client, event("customer.subscription.created", subscription()))
    [row] = rows()
    assert (row.plan, row.billing_interval, row.status) == ("professional", "monthly", "trialing")
    assert row.trial_end is not None and row.current_period_end is not None


def test_subscription_event_before_checkout_completed(client):
    send(client, event("customer.subscription.created", subscription(), id_="evt_a", created=100))
    [row] = rows()
    assert row.workspace_id is None
    send(client, event("checkout.session.completed", checkout_completed(), id_="evt_b", created=101))
    [row] = rows()
    assert (row.workspace_id, row.plan, row.status) == ("ws_A", "professional", "trialing")


def test_duplicate_event_is_noop(client):
    e = event("customer.subscription.created", subscription())
    assert send(client, e).json() == {"status": "ok"}
    assert send(client, e).json() == {"status": "duplicate"}
    assert len(rows()) == 1


def test_older_event_does_not_overwrite(client):
    send(client, event("customer.subscription.updated", subscription(status="active"), id_="evt_new", created=200))
    send(client, event("customer.subscription.updated", subscription(status="past_due"), id_="evt_old", created=100))
    [row] = rows()
    assert row.status == "active"


def test_deleted_marks_canceled(client):
    send(client, event("customer.subscription.created", subscription(), id_="evt_a", created=100))
    send(client, event("customer.subscription.deleted", subscription(status="canceled"), id_="evt_b", created=200))
    [row] = rows()
    assert row.status == "canceled"


def test_payment_failed_then_paid_toggles_flag(client):
    send(client, event("customer.subscription.created", subscription(), id_="evt_a"))
    send(client, event("invoice.payment_failed", {"id": "in_1", "object": "invoice", "subscription": "sub_1"}, id_="evt_b"))
    assert rows()[0].payment_failed is True
    # newer API versions nest the subscription under parent.subscription_details
    send(client, event("invoice.paid", {"id": "in_2", "object": "invoice",
                                        "parent": {"subscription_details": {"subscription": "sub_1"}}}, id_="evt_c"))
    assert rows()[0].payment_failed is False


def test_unhandled_event_ignored_200(client):
    r = send(client, event("customer.created", {"id": "cus_1", "object": "customer"}))
    assert r.status_code == 200
    assert r.json() == {"status": "ignored"}


def test_webhook_works_without_api_key(client, monkeypatch):
    """Signature verification needs only the webhook secret, not STRIPE_SECRET_KEY."""
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    assert send(client, event("customer.subscription.created", subscription())).status_code == 200


def test_unconfigured_webhook_secret_503(client, monkeypatch):
    monkeypatch.delenv("STRIPE_WEBHOOK_SECRET", raising=False)
    assert send(client, event("customer.subscription.created", subscription())).status_code == 503


def test_second_checkout_relinks_workspace_to_new_subscription(client):
    """Security review: workspace_id is unique; resubscribing must not 500 forever on retries."""
    send(client, event("checkout.session.completed", checkout_completed(sub_id="sub_old"), id_="evt_1"))
    r = send(client, event("checkout.session.completed", checkout_completed(sub_id="sub_new"), id_="evt_2"))
    assert r.status_code == 200
    linked = {row.stripe_subscription_id: row.workspace_id for row in rows()}
    assert linked == {"sub_old": None, "sub_new": "ws_A"}


def test_concurrent_duplicate_delivery_is_a_duplicate_not_500(client, monkeypatch):
    """Two deliveries of one event race past the duplicate check; the loser must not 500."""
    from app import billing
    from app.models import ProcessedEvent
    with SessionLocal() as db:
        db.add(ProcessedEvent(event_id="evt_race"))
        db.commit()
    monkeypatch.setattr(billing, "_already_processed", lambda db, event_id: False)  # simulate losing the race
    r = send(client, event("customer.subscription.created", subscription(), id_="evt_race"))
    assert r.status_code == 200
    assert r.json() == {"status": "duplicate"}
