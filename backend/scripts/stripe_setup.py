"""Create (or verify) the Stripe catalog, Customer Portal config and production webhook. Idempotent.

OWNER: Tray. Test mode only. Never prints a secret.

    vercel env pull .env.stripe --environment=production     # git-ignored (.env.*)
    python backend/scripts/stripe_setup.py --env-file .env.stripe
    rm .env.stripe

Recovery: Stripe returns a webhook secret only when the endpoint is created. If saving it to Vercel
fails, the new endpoint is deleted again, so simply rerun. If the secret was lost some other way,
rerun with --rotate-webhook (recreates the endpoint and saves the new secret). The run only reports
success after confirming every required Vercel variable exists.

The webhook signing secret is written straight to Vercel (`vercel env add STRIPE_WEBHOOK_SECRET
production`) through stdin when the endpoint is first created.
"""
from __future__ import annotations

import argparse
import os
import shutil
import subprocess
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))  # backend/ for `app`

from app import plans  # noqa: E402

WEBHOOK_URL = "https://ai-product-label-verification.vercel.app/api/billing/webhook"
WEBHOOK_EVENTS = [
    "checkout.session.completed",
    "checkout.session.expired",
    "customer.subscription.created",
    "customer.subscription.updated",
    "customer.subscription.deleted",
    "invoice.paid",
    "invoice.payment_failed",
]


def ensure_catalog(client, log=print) -> dict[str, str]:
    """One Product per plan, a monthly + annual Price each, found by lookup_key. Returns lookup_key -> price id."""
    price_ids: dict[str, str] = {}
    for plan in plans.PLANS.values():
        keys = [plans.lookup_key(plan.id, i) for i in plans.INTERVALS]
        found = {p.lookup_key: p for p in client.v1.prices.list(params={"lookup_keys": keys, "active": True, "limit": 10}).data}
        product_id = next((p.product for p in found.values()), None)
        if product_id is None:
            product = client.v1.products.create(params={"name": f"VeriLabel {plan.name}", "metadata": {"plan": plan.id}})
            product_id = product.id
            log(f"created product {plan.name}: {product_id}")
        for interval, cents in (("monthly", plan.monthly_cents), ("annual", plan.annual_cents)):
            key = plans.lookup_key(plan.id, interval)
            if key in found:
                log(f"exists  price {key}: {found[key].id}")
                price_ids[key] = found[key].id
                continue
            price = client.v1.prices.create(params={
                "product": product_id, "currency": "usd", "unit_amount": cents,
                "recurring": {"interval": "month" if interval == "monthly" else "year"},
                "lookup_key": key, "transfer_lookup_key": True,
            })
            log(f"created price {key}: {price.id}")
            price_ids[key] = price.id
    return price_ids


def ensure_portal(client, price_ids: dict[str, str], log=print) -> None:
    configs = client.v1.billing_portal.configurations.list(params={"is_default": True, "limit": 1}).data
    products: dict[str, list[str]] = {}
    for key, price_id in price_ids.items():
        products.setdefault(key.split("_")[0], []).append(price_id)
    features = {
        "customer_update": {"enabled": True, "allowed_updates": ["email", "address"]},
        "invoice_history": {"enabled": True},
        "payment_method_update": {"enabled": True},
        "subscription_cancel": {"enabled": True, "mode": "at_period_end"},
        "subscription_update": {"enabled": True, "default_allowed_updates": ["price"], "proration_behavior": "create_prorations",
                                "products": [{"product": _product_of(client, ids[0]), "prices": ids} for ids in products.values()]},
    }
    if configs:
        client.v1.billing_portal.configurations.update(configs[0].id, params={"features": features})
        log(f"updated portal configuration {configs[0].id}")
    else:
        created = client.v1.billing_portal.configurations.create(params={"features": features,
                                                                         "business_profile": {"headline": "VeriLabel billing (test mode)"}})
        log(f"created portal configuration {created.id}")


def _product_of(client, price_id: str) -> str:
    return client.v1.prices.retrieve(price_id).product


REQUIRED_ENV = ("STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET", "WORKSPACE_SECRET", "PUBLIC_URL")


def ensure_webhook(client, write_secret, log=print, rotate: bool = False) -> None:
    for endpoint in list(client.v1.webhook_endpoints.list(params={"limit": 100}).data):
        if endpoint.url != WEBHOOK_URL:
            continue
        if rotate:
            client.v1.webhook_endpoints.delete(endpoint.id)
            log(f"deleted webhook {endpoint.id} (rotating)")
            continue
        client.v1.webhook_endpoints.update(endpoint.id, params={"enabled_events": WEBHOOK_EVENTS})
        log(f"exists  webhook {endpoint.id} (events refreshed; secret unchanged)")
        return
    endpoint = client.v1.webhook_endpoints.create(params={"url": WEBHOOK_URL, "enabled_events": WEBHOOK_EVENTS,
                                                          "description": "VeriLabel production webhook"})
    try:
        write_secret(endpoint.secret)  # never printed
    except Exception:
        # The secret can't be fetched again later: drop the endpoint so a rerun creates a fresh one.
        client.v1.webhook_endpoints.delete(endpoint.id)
        log(f"saving the signing secret failed; deleted webhook {endpoint.id}. Rerun to retry.")
        raise
    log(f"created webhook {endpoint.id}; signing secret written to Vercel")


def missing_env(list_names) -> list[str]:
    """Required Vercel production variables that don't exist (names only; values never read)."""
    present = set(list_names())
    return [name for name in REQUIRED_ENV if name not in present]


def _vercel_env_names() -> set[str]:
    vercel = shutil.which("vercel") or "vercel"
    out = subprocess.run([vercel, "env", "ls", "production"], capture_output=True, text=True, check=True).stdout
    return {line.split()[0] for line in out.splitlines() if line.strip() and line.split()[0].isupper()}


def _vercel_env_add(secret: str) -> None:
    vercel = shutil.which("vercel") or "vercel"  # on Windows the CLI is vercel.cmd, which subprocess won't find by name
    subprocess.run([vercel, "env", "add", "STRIPE_WEBHOOK_SECRET", "production"], input=secret, text=True, check=True,
                   stdout=subprocess.DEVNULL)


def _load_env_file(path: str) -> None:
    """Read ONLY STRIPE_SECRET_KEY from a pulled env file (least privilege: no DATABASE_URL etc.)."""
    for line in Path(path).read_text().splitlines():
        k, sep, v = line.partition("=")
        if sep and k.strip() == "STRIPE_SECRET_KEY":
            os.environ.setdefault("STRIPE_SECRET_KEY", v.strip().strip('"'))


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--env-file")
    parser.add_argument("--rotate-webhook", action="store_true", help="recreate the webhook endpoint and save a new secret")
    args = parser.parse_args()
    if args.env_file:
        _load_env_file(args.env_file)
    key = os.getenv("STRIPE_SECRET_KEY", "")
    if not key.startswith(("sk_test_", "rk_test_")):
        print("STRIPE_SECRET_KEY must be a TEST-mode key (sk_test_/rk_test_). Refusing.", file=sys.stderr)
        return 1
    from stripe import StripeClient
    from app.billing import STRIPE_API_VERSION
    client = StripeClient(key, stripe_version=STRIPE_API_VERSION)
    price_ids = ensure_catalog(client)
    ensure_portal(client, price_ids)
    ensure_webhook(client, _vercel_env_add, rotate=args.rotate_webhook)
    missing = missing_env(_vercel_env_names)
    if missing:
        print(f"NOT DONE: missing Vercel production variables: {', '.join(missing)}", file=sys.stderr)
        if "STRIPE_WEBHOOK_SECRET" in missing:
            print("Rerun with --rotate-webhook to recreate the endpoint and save its secret.", file=sys.stderr)
        return 1
    print("OK: catalog, portal, webhook and Vercel variables verified. Redeploy to apply new variables.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
