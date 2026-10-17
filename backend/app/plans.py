"""Pricing catalog. The single source of truth for plans, prices and limits (ADR 0003).

OWNER: Amzad (built by Tray, Oct 17). Stripe Prices are found by lookup_key(plan, interval);
change a price here AND in Stripe (backend/scripts/stripe_setup.py) together.
Limits are displayed, not enforced. None means unlimited.
"""
from __future__ import annotations

from dataclasses import asdict, dataclass

INTERVALS = ("monthly", "annual")
TRIAL_DAYS = 14


@dataclass(frozen=True)
class Plan:
    id: str
    name: str
    monthly_cents: int
    annual_cents: int
    inspections_per_month: int | None
    saved_specs: int | None
    history_days: int | None
    highlight: bool = False

    def to_dict(self) -> dict:
        return {**asdict(self), "trial_days": TRIAL_DAYS}


PLANS: dict[str, Plan] = {
    p.id: p
    for p in (
        Plan("starter", "Starter", 4900, 49000, 200, 10, 90),
        Plan("professional", "Professional", 14900, 149000, 1000, None, 365, highlight=True),
        Plan("enterprise", "Enterprise", 49900, 499000, None, None, None),
    )
}


def lookup_key(plan_id: str, interval: str) -> str:
    """'professional', 'annual' -> 'professional_annual'. KeyError on an unknown plan or interval."""
    if plan_id not in PLANS:
        raise KeyError(plan_id)
    if interval not in INTERVALS:
        raise KeyError(interval)
    return f"{plan_id}_{interval}"
