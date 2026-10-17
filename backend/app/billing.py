"""Stripe Billing: checkout, webhook, status, customer portal (ADR 0003).

OWNER: Amzad (built by Tray, Oct 17). Test mode only: get_stripe() refuses live keys.
The webhook is the only writer of subscription state; never trust the success redirect.
"""
from __future__ import annotations

import os
import random
import string
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from stripe import StripeClient

from app import plans
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
    return (request.headers.get("origin") or os.getenv("PUBLIC_URL") or "http://localhost:3000").rstrip("/")


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
