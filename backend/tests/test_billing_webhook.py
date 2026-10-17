"""POST /billing/webhook: signature, idempotency, reconciliation (ADR 0003).  OWNER: Amzad (built by Tray, Oct 17)

Event payloads are only triggers. Stripe can't order events reliably (second-level timestamps), so the
webhook re-reads the subscription from Stripe and stores THAT. Tests set Stripe's current state in
FakeStripe.subscriptions, then deliver stale or out-of-order snapshots.
"""
import hashlib
import hmac
import json
import time

import pytest

from app.database import SessionLocal
from app.models import PendingCheckout, Subscription

SECRET = "whsec_test"


@pytest.fixture(autouse=True)
def _secret(monkeypatch):
    monkeypatch.setenv("STRIPE_WEBHOOK_SECRET", SECRET)


def send(client, event: dict, secret: str = SECRET, signature=None):
    body = json.dumps(event)
    ts = int(time.time())
    sig = hmac.new(secret.encode(), f"{ts}.{body}".encode(), hashlib.sha256).hexdigest()
    headers = {"Content-Type": "application/json"}
    if signature is not False:
        headers["Stripe-Signature"] = signature or f"t={ts},v1={sig}"
    return client.post("/billing/webhook", content=body, headers=headers)


def event(type_: str, obj: dict, id_: str = "evt_1", created: int = 100):
    return {"id": id_, "object": "event", "type": type_, "created": created, "data": {"object": obj}}


def sub(status="trialing", key="professional_monthly", sub_id="sub_1", created=1000, trial_end=1_900_000_000):
    """A Stripe subscription (used both as Stripe's current state and as an event snapshot)."""
    return {"id": sub_id, "object": "subscription", "customer": "cus_1", "status": status, "created": created,
            "trial_end": trial_end, "items": {"data": [{"price": {"lookup_key": key}, "current_period_end": 1_900_000_000}]}}


def checkout_completed(sub_id="sub_1", workspace="ws_A", session_id="cs_1"):
    return {"id": session_id, "object": "checkout.session", "mode": "subscription",
            "subscription": sub_id, "customer": "cus_1", "client_reference_id": workspace}


def rows():
    with SessionLocal() as db:
        return {r.stripe_subscription_id: r for r in db.query(Subscription).all()}


def test_bad_signature_400(client, fake_stripe):
    fake_stripe(subscriptions={"sub_1": sub()})
    assert send(client, event("customer.subscription.created", sub()), secret="whsec_wrong").status_code == 400
    assert rows() == {}


def test_missing_signature_400(client, fake_stripe):
    fake_stripe()
    assert send(client, event("customer.subscription.created", sub()), signature=False).status_code == 400


def test_unconfigured_webhook_secret_503(client, monkeypatch, fake_stripe):
    fake_stripe()
    monkeypatch.delenv("STRIPE_WEBHOOK_SECRET", raising=False)
    assert send(client, event("customer.subscription.created", sub())).status_code == 503


def test_webhook_without_api_key_is_503_so_stripe_retries(client, monkeypatch):
    """Reconciling needs the API key; without it, 503 makes Stripe retry later instead of losing the event."""
    monkeypatch.delenv("STRIPE_SECRET_KEY", raising=False)
    assert send(client, event("customer.subscription.created", sub())).status_code == 503


def test_checkout_completed_links_workspace_and_reconciles(client, fake_stripe):
    fake_stripe(subscriptions={"sub_1": sub(status="trialing")})
    assert send(client, event("checkout.session.completed", checkout_completed())).status_code == 200
    row = rows()["sub_1"]
    assert (row.workspace_id, row.stripe_customer_id, row.plan, row.billing_interval, row.status) == \
        ("ws_A", "cus_1", "professional", "monthly", "trialing")


def test_checkout_completed_clears_the_pending_checkout(client, fake_stripe):
    from datetime import datetime, timedelta, timezone
    fake_stripe(subscriptions={"sub_1": sub()})
    with SessionLocal() as db:
        db.add(PendingCheckout(workspace_id="ws_A", session_id="cs_1", url="u", plan="professional", billing_interval="monthly",
                               expires_at=datetime.now(timezone.utc) + timedelta(minutes=30)))
        db.commit()
    send(client, event("checkout.session.completed", checkout_completed()))
    with SessionLocal() as db:
        assert db.query(PendingCheckout).count() == 0


def test_checkout_expired_clears_the_pending_checkout(client, fake_stripe):
    from datetime import datetime, timedelta, timezone
    fake_stripe()
    with SessionLocal() as db:
        db.add(PendingCheckout(workspace_id="ws_A", session_id="cs_9", url="u", plan="professional", billing_interval="monthly",
                               expires_at=datetime.now(timezone.utc) + timedelta(minutes=30)))
        db.commit()
    send(client, event("checkout.session.expired", {"id": "cs_9", "object": "checkout.session", "client_reference_id": "ws_A"}))
    with SessionLocal() as db:
        assert db.query(PendingCheckout).count() == 0


def test_subscription_event_before_checkout_completed(client, fake_stripe):
    fake_stripe(subscriptions={"sub_1": sub()})
    send(client, event("customer.subscription.created", sub(), id_="evt_a"))
    assert rows()["sub_1"].workspace_id is None
    send(client, event("checkout.session.completed", checkout_completed(), id_="evt_b"))
    assert len(rows()) == 1 and rows()["sub_1"].workspace_id == "ws_A"


def test_duplicate_event_is_noop(client, fake_stripe):
    fake_stripe(subscriptions={"sub_1": sub()})
    e = event("customer.subscription.created", sub())
    assert send(client, e).json() == {"status": "ok"}
    assert send(client, e).json() == {"status": "duplicate"}
    assert len(rows()) == 1


def test_stale_same_second_snapshot_cannot_regress_state(client, fake_stripe):
    """Review finding 3: an older 'trialing' snapshot with the same timestamp, delivered last."""
    fake_stripe(subscriptions={"sub_1": sub(status="active")})
    send(client, event("customer.subscription.updated", sub(status="active"), id_="evt_new", created=200))
    send(client, event("customer.subscription.updated", sub(status="trialing"), id_="evt_old", created=200))
    assert rows()["sub_1"].status == "active"


def test_deleted_marks_canceled(client, fake_stripe):
    stripe = fake_stripe(subscriptions={"sub_1": sub()})
    send(client, event("customer.subscription.created", sub(), id_="evt_a"))
    stripe.subscriptions["sub_1"] = sub(status="canceled")
    send(client, event("customer.subscription.deleted", sub(status="canceled"), id_="evt_b"))
    assert rows()["sub_1"].status == "canceled"


def test_stale_payment_failed_does_not_flag_a_healthy_subscription(client, fake_stripe):
    """Review finding 4: an old invoice.payment_failed arriving after invoice.paid."""
    fake_stripe(subscriptions={"sub_1": sub(status="active")})
    send(client, event("invoice.paid", {"id": "in_2", "object": "invoice", "subscription": "sub_1"}, id_="evt_paid"))
    send(client, event("invoice.payment_failed", {"id": "in_1", "object": "invoice", "subscription": "sub_1"}, id_="evt_failed"))
    assert rows()["sub_1"].payment_failed is False


def test_payment_failure_follows_stripe_status(client, fake_stripe):
    stripe = fake_stripe(subscriptions={"sub_1": sub(status="past_due")})
    send(client, event("invoice.payment_failed", {"id": "in_1", "object": "invoice", "subscription": "sub_1"}, id_="evt_a"))
    assert rows()["sub_1"].payment_failed is True
    stripe.subscriptions["sub_1"] = sub(status="active")
    # newer API versions nest the subscription under parent.subscription_details
    send(client, event("invoice.paid", {"id": "in_2", "object": "invoice",
                                        "parent": {"subscription_details": {"subscription": "sub_1"}}}, id_="evt_b"))
    assert rows()["sub_1"].payment_failed is False


def test_older_checkout_does_not_replace_newer_link(client, fake_stripe):
    """Review finding 2: the newer checkout's event arrives first, the older one last."""
    fake_stripe(subscriptions={"sub_new": sub(sub_id="sub_new", created=2000), "sub_old": sub(sub_id="sub_old", created=1000)})
    send(client, event("checkout.session.completed", checkout_completed(sub_id="sub_new", session_id="cs_new"), id_="evt_1"))
    send(client, event("checkout.session.completed", checkout_completed(sub_id="sub_old", session_id="cs_old"), id_="evt_2"))
    linked = {sid: r.workspace_id for sid, r in rows().items()}
    assert linked == {"sub_new": "ws_A", "sub_old": None}


def test_newer_checkout_replaces_older_link(client, fake_stripe):
    """Resubscribing (a genuinely newer subscription) still moves the workspace over."""
    fake_stripe(subscriptions={"sub_old": sub(sub_id="sub_old", created=1000), "sub_new": sub(sub_id="sub_new", created=2000)})
    send(client, event("checkout.session.completed", checkout_completed(sub_id="sub_old", session_id="cs_old"), id_="evt_1"))
    r = send(client, event("checkout.session.completed", checkout_completed(sub_id="sub_new", session_id="cs_new"), id_="evt_2"))
    assert r.status_code == 200
    assert {sid: r.workspace_id for sid, r in rows().items()} == {"sub_old": None, "sub_new": "ws_A"}


def test_concurrent_duplicate_delivery_is_a_duplicate_not_500(client, fake_stripe, monkeypatch):
    from app import billing
    from app.models import ProcessedEvent
    fake_stripe(subscriptions={"sub_1": sub()})
    with SessionLocal() as db:
        db.add(ProcessedEvent(event_id="evt_race"))
        db.commit()
    monkeypatch.setattr(billing, "_already_processed", lambda db, event_id: False)  # lost the race
    r = send(client, event("customer.subscription.created", sub(), id_="evt_race"))
    assert r.status_code == 200 and r.json() == {"status": "duplicate"}


def test_unhandled_event_ignored_200(client, fake_stripe):
    fake_stripe()
    r = send(client, event("customer.created", {"id": "cus_1", "object": "customer"}))
    assert r.status_code == 200 and r.json() == {"status": "ignored"}
