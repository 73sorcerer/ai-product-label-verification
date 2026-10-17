"""Stripe Billing: checkout, webhook, status, customer portal (ADR 0003).

OWNER: Amzad (built by Tray, Oct 17). Test mode only: get_stripe() refuses live keys.
The webhook is the only writer of subscription state; never trust the success redirect.
"""
from __future__ import annotations

import json
import os
import random
import string
from datetime import datetime, timedelta, timezone
from typing import Literal

import stripe as stripe_sdk
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session
from stripe import StripeClient

from app import plans
from app.database import get_db
from app.models import PendingCheckout, ProcessedEvent, Subscription
from app.workspace import get_workspace_id

STRIPE_API_VERSION = "2026-08-26.dahlia"
NOT_CONFIGURED = "Billing is not configured"

router = APIRouter(prefix="/billing", tags=["billing"])


def get_stripe() -> StripeClient:
    """A StripeClient for a TEST-mode key, or 503. Never a module-level api_key."""
    key = os.getenv("STRIPE_SECRET_KEY", "")
    if not key.startswith(("sk_test_", "rk_test_")):
        raise HTTPException(503, NOT_CONFIGURED)
    return StripeClient(key, stripe_version=STRIPE_API_VERSION)


def get_stripe_optional() -> StripeClient | None:
    """Like get_stripe() but None instead of 503, for the webhook: it verifies the signature first."""
    try:
        return get_stripe()
    except HTTPException:
        return None


def _origin(request: Request) -> str:
    """Where Stripe sends the payer back. Origin is caller-controlled, so it's only used when it's
    on the allowlist (PUBLIC_URL + CORS_ORIGINS); otherwise PUBLIC_URL. Prevents an open redirect."""
    vercel_domain = os.getenv("VERCEL_PROJECT_PRODUCTION_URL")  # set by Vercel, e.g. "my-app.vercel.app"
    public = (os.getenv("PUBLIC_URL") or (f"https://{vercel_domain}" if vercel_domain else "http://localhost:3000")).rstrip("/")
    allowed = {public, *(o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip())}
    origin = (request.headers.get("origin") or "").rstrip("/")
    return origin if origin in allowed else public


# A second checkout while one of these is live would double-bill.
LIVE_STATUSES = {"trialing", "active", "past_due", "unpaid", "incomplete"}


class CheckoutIn(BaseModel):
    plan: Literal["starter", "professional", "enterprise"]
    interval: Literal["monthly", "annual"]


CHECKOUT_TTL = timedelta(minutes=30)  # Stripe's minimum session lifetime; short so abandoned links die fast
REUSE_MARGIN = timedelta(minutes=2)   # don't hand out a link that's about to expire


def _pending_for(db: Session, workspace_id: str) -> PendingCheckout | None:
    return db.get(PendingCheckout, workspace_id)


def _expire_session(stripe: StripeClient, session_id: str) -> None:
    try:
        stripe.v1.checkout.sessions.expire(session_id)
    except Exception:  # already completed or expired: nothing left to close
        pass


@router.post("/checkout")
def create_checkout(
    body: CheckoutIn,
    request: Request,
    workspace_id: str = Depends(get_workspace_id),
    stripe: StripeClient = Depends(get_stripe),
    db: Session = Depends(get_db),
):
    """One open Checkout Session per workspace (review finding 1): two open links could both be
    paid and create two subscriptions."""
    existing = db.scalar(select(Subscription).where(Subscription.workspace_id == workspace_id))
    if existing is not None and existing.status in LIVE_STATUSES:
        raise HTTPException(409, "This workspace already has a subscription. Use Manage billing to change plans.")

    now = datetime.now(timezone.utc)
    pending = _pending_for(db, workspace_id)
    if pending is not None:
        expires = pending.expires_at if pending.expires_at.tzinfo else pending.expires_at.replace(tzinfo=timezone.utc)
        if (pending.plan, pending.billing_interval) == (body.plan, body.interval) and expires - now > REUSE_MARGIN:
            return {"url": pending.url}
        _expire_session(stripe, pending.session_id)  # different plan or nearly expired: close it first
        db.delete(pending)
        db.commit()

    key = plans.lookup_key(body.plan, body.interval)
    prices = stripe.v1.prices.list(params={"lookup_keys": [key], "active": True})
    if not prices.data:
        raise HTTPException(502, "Stripe price not found")
    origin = _origin(request)
    expires_at = now + CHECKOUT_TTL
    session = stripe.v1.checkout.sessions.create(
        params={
            "mode": "subscription",
            "line_items": [{"price": prices.data[0].id, "quantity": 1}],
            "subscription_data": {"trial_period_days": plans.TRIAL_DAYS},
            "client_reference_id": workspace_id,
            "success_url": f"{origin}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": f"{origin}/pricing",
            "expires_at": int(expires_at.timestamp()),
            "integration_identifier": "labelguard-pricing-" + "".join(random.choices(string.ascii_lowercase, k=8)),
        }
    )
    db.add(PendingCheckout(workspace_id=workspace_id, session_id=session.id, url=session.url,
                           plan=body.plan, billing_interval=body.interval, expires_at=expires_at))
    try:
        db.commit()
    except IntegrityError:
        # A concurrent request for this workspace won: close ours, hand back theirs.
        db.rollback()
        _expire_session(stripe, session.id)
        winner = db.get(PendingCheckout, workspace_id)
        if winner is None:
            raise HTTPException(409, "Checkout is already starting. Try again.")
        return {"url": winner.url}
    return {"url": session.url}


# --- status + portal -------------------------------------------------------------


def _iso(value: datetime | None) -> str | None:
    if value is None:
        return None
    if value.tzinfo is None:  # SQLite drops the timezone; every stored time is UTC
        value = value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc).isoformat()


def _subscription_for(db: Session, workspace_id: str) -> Subscription | None:
    return db.scalar(select(Subscription).where(Subscription.workspace_id == workspace_id))


@router.get("/status")
def billing_status(workspace_id: str = Depends(get_workspace_id), db: Session = Depends(get_db)):
    """This workspace's plan. All null before the webhook has recorded anything (never 404)."""
    row = _subscription_for(db, workspace_id)
    if row is None:
        return {"plan": None, "interval": None, "status": None, "trial_end": None, "current_period_end": None, "payment_failed": False}
    return {
        "plan": row.plan,
        "interval": row.billing_interval,
        "status": row.status,
        "trial_end": _iso(row.trial_end),
        "current_period_end": _iso(row.current_period_end),
        "payment_failed": bool(row.payment_failed),
    }


@router.post("/portal")
def billing_portal(
    request: Request,
    response: Response,
    workspace_id: str = Depends(get_workspace_id),
    stripe: StripeClient = Depends(get_stripe),
    db: Session = Depends(get_db),
):
    row = _subscription_for(db, workspace_id)
    if row is None or not row.stripe_customer_id:
        # Returned (not raised) so a freshly issued workspace cookie isn't dropped.
        error = JSONResponse({"detail": "No subscription for this workspace"}, status_code=404)
        for cookie in response.headers.getlist("set-cookie"):
            error.headers.append("set-cookie", cookie)
        return error
    session = stripe.v1.billing_portal.sessions.create(
        params={"customer": row.stripe_customer_id, "return_url": f"{_origin(request)}/pricing"}
    )
    return {"url": session.url}


# --- webhook ------------------------------------------------------------------

SUBSCRIPTION_EVENTS = {"customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"}
HANDLED = SUBSCRIPTION_EVENTS | {"checkout.session.completed", "invoice.paid", "invoice.payment_failed"}


def _ts(value: int | None) -> datetime | None:
    return datetime.fromtimestamp(value, tz=timezone.utc) if value else None


def _as_dict(obj) -> dict:
    return obj.to_dict() if hasattr(obj, "to_dict") else dict(obj)


def _row(db: Session, subscription_id: str) -> Subscription:
    row = db.scalar(select(Subscription).where(Subscription.stripe_subscription_id == subscription_id))
    if row is None:
        row = Subscription(stripe_subscription_id=subscription_id, payment_failed=False, last_event_created=0)
        db.add(row)
        db.flush()
    return row


def _already_processed(db: Session, event_id: str) -> bool:
    return db.get(ProcessedEvent, event_id) is not None


def _invoice_subscription(invoice: dict) -> str | None:
    # Older API versions: invoice.subscription; newer: invoice.parent.subscription_details.subscription
    return invoice.get("subscription") or ((invoice.get("parent") or {}).get("subscription_details") or {}).get("subscription")


def _reconcile(db: Session, stripe: StripeClient, subscription_id: str) -> tuple[Subscription, dict]:
    """Store Stripe's CURRENT subscription state, not the event's snapshot (review findings 3 + 4):
    Stripe timestamps are second-level and can't order events, so stale deliveries can't regress state."""
    current = _as_dict(stripe.v1.subscriptions.retrieve(subscription_id))
    row = _row(db, subscription_id)
    item = ((current.get("items") or {}).get("data") or [{}])[0]
    lookup = (item.get("price") or {}).get("lookup_key") or ""
    plan, _, interval = lookup.partition("_")
    row.plan = plan if plan in plans.PLANS else None
    row.billing_interval = interval if interval in plans.INTERVALS else None
    row.status = current.get("status")
    row.trial_end = _ts(current.get("trial_end"))
    row.current_period_end = _ts(item.get("current_period_end") or current.get("current_period_end"))
    row.stripe_customer_id = current.get("customer") or row.stripe_customer_id
    row.payment_failed = current.get("status") in ("past_due", "unpaid")  # from Stripe's state, not event order
    return row, current


def _link_workspace(db: Session, stripe: StripeClient, row: Subscription, current: dict, workspace_id: str) -> None:
    """Point the workspace at this subscription unless it's already linked to a NEWER one (review finding 2)."""
    linked = db.scalar(select(Subscription).where(Subscription.workspace_id == workspace_id, Subscription.id != row.id))
    if linked is not None:
        other = _as_dict(stripe.v1.subscriptions.retrieve(linked.stripe_subscription_id))
        if (other.get("created") or 0, linked.stripe_subscription_id) > (current.get("created") or 0, row.stripe_subscription_id):
            return  # a delayed event for an older checkout: keep the newer link
        linked.workspace_id = None
        db.flush()  # free the unique workspace_id before reassigning it
    row.workspace_id = workspace_id


SUBSCRIPTION_EVENTS = {"customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"}
HANDLED = SUBSCRIPTION_EVENTS | {"checkout.session.completed", "checkout.session.expired", "invoice.paid", "invoice.payment_failed"}


def _drop_pending(db: Session, session: dict) -> None:
    workspace_id = session.get("client_reference_id")
    pending = db.get(PendingCheckout, workspace_id) if workspace_id else None
    if pending is not None and pending.session_id == session.get("id"):
        db.delete(pending)


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db),
                         stripe: StripeClient | None = Depends(get_stripe_optional)):
    """The only writer of subscription state. Verifies the signature on the RAW body, then treats the
    event as a trigger and reconciles against Stripe."""
    secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not secret:
        raise HTTPException(503, NOT_CONFIGURED)
    payload = await request.body()
    try:
        stripe_sdk.Webhook.construct_event(payload, request.headers.get("stripe-signature", ""), secret)
    except (ValueError, stripe_sdk.SignatureVerificationError):
        raise HTTPException(400, "Invalid signature")
    event = json.loads(payload)  # verified

    if _already_processed(db, event["id"]):
        return {"status": "duplicate"}
    if event["type"] not in HANDLED:
        return {"status": "ignored"}
    if stripe is None:  # reconciling needs the API key; 503 so Stripe retries once it's configured
        raise HTTPException(503, NOT_CONFIGURED)

    obj = event["data"]["object"]
    if event["type"] == "checkout.session.completed":
        _drop_pending(db, obj)
        if obj.get("mode") == "subscription" and obj.get("subscription"):
            row, current = _reconcile(db, stripe, obj["subscription"])
            row.stripe_customer_id = obj.get("customer") or row.stripe_customer_id
            if obj.get("client_reference_id"):
                _link_workspace(db, stripe, row, current, obj["client_reference_id"])
    elif event["type"] == "checkout.session.expired":
        _drop_pending(db, obj)
    elif event["type"] in SUBSCRIPTION_EVENTS:
        _reconcile(db, stripe, obj["id"])
    else:  # invoice.paid / invoice.payment_failed
        sub_id = _invoice_subscription(obj)
        if sub_id:
            _reconcile(db, stripe, sub_id)

    db.add(ProcessedEvent(event_id=event["id"]))
    try:
        db.commit()
    except IntegrityError:
        # A concurrent delivery of the same event won the race: that's a duplicate, not a failure.
        db.rollback()
        if db.get(ProcessedEvent, event["id"]) is not None:
            return {"status": "duplicate"}
        raise
    return {"status": "ok"}
