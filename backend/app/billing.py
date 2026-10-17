"""Stripe Billing: checkout, webhook, status, customer portal (ADR 0003).

OWNER: Amzad (built by Tray, Oct 17). Test mode only: get_stripe() refuses live keys.
The webhook is the only writer of subscription state; never trust the success redirect.
"""
from __future__ import annotations

import json
import os
import random
import string
from datetime import datetime, timezone
from typing import Literal

import stripe as stripe_sdk
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session
from stripe import StripeClient

from app import plans
from app.database import get_db
from app.models import ProcessedEvent, Subscription
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


def _origin(request: Request) -> str:
    """Where Stripe sends the payer back. Origin is caller-controlled, so it's only used when it's
    on the allowlist (PUBLIC_URL + CORS_ORIGINS); otherwise PUBLIC_URL. Prevents an open redirect."""
    public = (os.getenv("PUBLIC_URL") or "http://localhost:3000").rstrip("/")
    allowed = {public, *(o.strip().rstrip("/") for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip())}
    origin = (request.headers.get("origin") or "").rstrip("/")
    return origin if origin in allowed else public


class CheckoutIn(BaseModel):
    plan: Literal["starter", "professional", "enterprise"]
    interval: Literal["monthly", "annual"]


@router.post("/checkout")
def create_checkout(
    body: CheckoutIn,
    request: Request,
    workspace_id: str = Depends(get_workspace_id),
    stripe: StripeClient = Depends(get_stripe),
):
    key = plans.lookup_key(body.plan, body.interval)
    prices = stripe.v1.prices.list(params={"lookup_keys": [key], "active": True})
    if not prices.data:
        raise HTTPException(502, "Stripe price not found")
    origin = _origin(request)
    session = stripe.v1.checkout.sessions.create(
        params={
            "mode": "subscription",
            "line_items": [{"price": prices.data[0].id, "quantity": 1}],
            "subscription_data": {"trial_period_days": plans.TRIAL_DAYS},
            "client_reference_id": workspace_id,
            "success_url": f"{origin}/billing/success?session_id={{CHECKOUT_SESSION_ID}}",
            "cancel_url": f"{origin}/pricing",
            "integration_identifier": "labelguard-pricing-" + "".join(random.choices(string.ascii_lowercase, k=8)),
        }
    )
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


def _row(db: Session, subscription_id: str) -> Subscription:
    row = db.scalar(select(Subscription).where(Subscription.stripe_subscription_id == subscription_id))
    if row is None:
        row = Subscription(stripe_subscription_id=subscription_id, payment_failed=False, last_event_created=0)
        db.add(row)
    return row


def _invoice_subscription(invoice: dict) -> str | None:
    # Older API versions: invoice.subscription; newer: invoice.parent.subscription_details.subscription
    return invoice.get("subscription") or ((invoice.get("parent") or {}).get("subscription_details") or {}).get("subscription")


@router.post("/webhook")
async def stripe_webhook(request: Request, db: Session = Depends(get_db)):
    """The only writer of subscription state. Verifies the signature on the RAW body first."""
    secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    if not secret:
        raise HTTPException(503, NOT_CONFIGURED)
    payload = await request.body()
    try:
        stripe_sdk.Webhook.construct_event(payload, request.headers.get("stripe-signature", ""), secret)
    except (ValueError, stripe_sdk.SignatureVerificationError):
        raise HTTPException(400, "Invalid signature")
    event = json.loads(payload)  # verified; plain dicts are simpler than StripeObject here

    if db.get(ProcessedEvent, event["id"]):
        return {"status": "duplicate"}
    if event["type"] not in HANDLED:
        return {"status": "ignored"}

    obj = event["data"]["object"]
    if event["type"] == "checkout.session.completed":
        if obj.get("mode") == "subscription" and obj.get("subscription"):
            row = _row(db, obj["subscription"])
            row.workspace_id = obj.get("client_reference_id")
            row.stripe_customer_id = obj.get("customer")
    elif event["type"] in SUBSCRIPTION_EVENTS:
        row = _row(db, obj["id"])
        if event["created"] >= (row.last_event_created or 0):  # never let an older event overwrite newer state
            item = (obj.get("items") or {}).get("data", [{}])[0]
            lookup = (item.get("price") or {}).get("lookup_key") or ""
            plan, _, interval = lookup.partition("_")
            row.plan = plan if plan in plans.PLANS else None
            row.billing_interval = interval if interval in plans.INTERVALS else None
            row.status = "canceled" if event["type"] == "customer.subscription.deleted" else obj.get("status")
            row.trial_end = _ts(obj.get("trial_end"))
            row.current_period_end = _ts(item.get("current_period_end") or obj.get("current_period_end"))
            row.stripe_customer_id = obj.get("customer") or row.stripe_customer_id
            row.last_event_created = event["created"]
    else:  # invoice.paid / invoice.payment_failed
        sub_id = _invoice_subscription(obj)
        if sub_id:
            _row(db, sub_id).payment_failed = event["type"] == "invoice.payment_failed"

    db.add(ProcessedEvent(event_id=event["id"]))
    db.commit()
    return {"status": "ok"}
