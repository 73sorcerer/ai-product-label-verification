# Pricing + Stripe Billing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `/pricing` page with three paid plans (Starter $49, Professional $149, Enterprise $499, 14-day trial) that subscribe through Stripe Checkout in test mode, with webhook-driven subscription state and the Customer Portal.

**Architecture:** A static plan catalog serves `/plans`. A `billing` FastAPI router creates Checkout and Portal sessions through an injected `StripeClient`, and a signature-verified webhook is the only writer of the `subscriptions` table. Subscriptions are keyed by a signed browser cookie (`workspace_id`) that becomes the Clerk org ID later. Next.js adds `/pricing`, `/billing/success` and a sidebar plan badge.

**Tech Stack:** FastAPI + SQLAlchemy (existing), `stripe` Python SDK ≥ 15.6 (`StripeClient`), Stripe API `2026-08-26.dahlia`, Next.js 16 + Tailwind (existing), Vercel Marketplace Stripe integration, Neon Postgres (existing).

**Spec:** [ADR 0003: pricing + Stripe billing](../../adr/0003-pricing-and-stripe-billing.md) and [ADR 0004: workspace identity](../../adr/0004-workspace-identity-now-clerk-later.md). Read both first.

**Executor / reviewers:** Tray's agent builds it all in one PR (decided Oct 17). Amzad reviews `backend/`, Wenyi reviews `frontend/`. Branch: `feature/billing-stripe` from the latest `main` (AGENTS.md git rules apply).

## Global Constraints

- Prices (cents): `starter` 4900 / 49000, `professional` 14900 / 149000, `enterprise` 49900 / 499000 (monthly / annual). Currency `usd`.
- Lookup keys: `{plan}_{interval}`, with interval `monthly` | `annual` (e.g. `professional_annual`).
- Limits (display only, never enforced): starter 200 inspections/mo, 10 specs, 90-day history; professional 1000 / unlimited / 365; enterprise unlimited / unlimited / unlimited. "Unlimited" is `null` in JSON.
- Trial: `trial_period_days=14` on every Checkout Session.
- Stripe: always a `StripeClient` instance, never `stripe.api_key = …`. Never pass `payment_method_types`. Pass `integration_identifier="labelguard-pricing-" + 8 random lowercase letters`.
- Test mode only: billing is disabled (HTTP 503 "Billing is not configured") unless `STRIPE_SECRET_KEY` starts with `sk_test_` or `rk_test_`.
- Secrets (`STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `WORKSPACE_SECRET`) live only in Vercel env vars. Never in the repo, logs, or error messages. Agents never read `.env*` files.
- Webhook: verify the signature on the **raw** request body before parsing; respond 200 to unhandled event types.
- Stripe Tax stays off (no `automatic_tax`).
- Cookie: `lg_workspace`, HttpOnly, SameSite=Lax, Path=/, Secure when `VERCEL` is set, max-age 1 year.
- Frontend copy: buttons say "Start 14-day trial"; the success page says "Confirming your subscription…" until the plan is recorded. No invented features: list only the three limits plus "Pass / Needs Review verification" and "OCR confidence flags" (both exist).

## Review Focus

1. **Webhook before checkout:** `customer.subscription.created` can arrive before `checkout.session.completed`. Expected: the row is created by subscription ID with `workspace_id` null, and later filled in. Pinned in Task 4.
2. **Duplicate or old events:** Stripe retries deliveries and doesn't guarantee order. Expected: a repeated event ID is a no-op; an event older than the row's `last_event_created` doesn't overwrite it. Pinned in Task 4.
3. **Returning before the webhook:** the visitor lands on `/billing/success` before Stripe's webhook arrives. Expected: `/billing/status` returns `plan: null` (not an error) and the page keeps polling. Pinned in Tasks 5 and 9.
4. **Tampered or foreign cookie:** an edited `lg_workspace` value. Expected: treated as no cookie (a fresh workspace); it can never read or open the portal for another workspace's subscription. Pinned in Task 2.
5. **Live key configured by mistake:** expected 503 on checkout and portal; `/plans` still works. Pinned in Task 3.

---

### Task 0: Pre-flight fixes (no code)

- [ ] **Step 1:** Merge Wenyi's docs PRs #25 and #26 once checks pass.
- [ ] **Step 2:** Delete the production test specs (human, Neon console → SQL editor on `labelguard-db`). Verified Oct 17 that specs 4–6 have no inspections:
  ```sql
  SELECT id, name FROM product_specs WHERE id IN (4, 5, 6);  -- expect: 3 rows, all 'E2E Test …'
  DELETE FROM product_specs WHERE id IN (4, 5, 6) AND name LIKE 'E2E Test%'
    AND NOT EXISTS (SELECT 1 FROM inspections i WHERE i.spec_id = product_specs.id);
  ```
  Verify: `curl -s https://ai-product-label-verification.vercel.app/api/specs` lists only the three sample specs.
- [ ] **Step 3:** Upgrade the Stripe CLI (`npm i -g @stripe/cli`; the installed 1.37.8 lacks `whoami`).

### Task 1: Plan catalog and `GET /plans`

**Files:**
- Create: `backend/app/plans.py`
- Modify: `backend/app/main.py` (add the route next to `/health`)
- Test: `backend/tests/test_billing_plans.py`

**Interfaces:**
- Produces: `PLANS: dict[str, Plan]`, `Plan` (frozen dataclass: `id, name, monthly_cents, annual_cents, inspections_per_month: int | None, saved_specs: int | None, history_days: int | None, highlight: bool`), `lookup_key(plan_id: str, interval: str) -> str` (raises `KeyError` on unknown plan or interval), `INTERVALS = ("monthly", "annual")`.
- `GET /plans` → `200 [{"id","name","monthly_cents","annual_cents","inspections_per_month","saved_specs","history_days","highlight","trial_days":14}]`, in order starter, professional, enterprise.

- [ ] **Step 1: Write failing tests:** `test_plans_lists_three_tiers_in_order` (ids == `["starter","professional","enterprise"]`); `test_plan_prices_match_adr` (4900/49000, 14900/149000, 49900/499000); `test_unlimited_is_null` (enterprise `inspections_per_month is None`); `test_only_professional_is_highlighted`; `test_lookup_key` (`lookup_key("professional","annual") == "professional_annual"`; unknown plan or interval raises `KeyError`); `test_plans_works_without_stripe_key` (env without `STRIPE_SECRET_KEY` → 200).
- [ ] **Step 2:** `cd backend && pytest tests/test_billing_plans.py -q` → FAIL (module missing).
- [ ] **Step 3:** Implement `plans.py` and the route (no Stripe call; plain data).
- [ ] **Step 4:** Same command → PASS.
- [ ] **Step 5:** Commit `billing: plan catalog and GET /plans`.

### Task 2: Signed workspace cookie

**Files:**
- Create: `backend/app/workspace.py`
- Test: `backend/tests/test_workspace.py`

**Interfaces:**
- Produces: `sign(workspace_id: str, secret: str) -> str` (format `"{id}.{hex_hmac_sha256}"`), `verify(cookie: str | None, secret: str) -> str | None` (uses `hmac.compare_digest`), and the FastAPI dependency `get_workspace_id(request: Request, response: Response) -> str`, which returns the verified ID, or creates `uuid4().hex`, sets the cookie (Global Constraints), and returns it. `COOKIE = "lg_workspace"`. Secret from `WORKSPACE_SECRET`; if unset, use `"dev-only-secret"` only when `VERCEL` is unset, otherwise raise HTTP 503.

- [ ] **Step 1: Write failing tests:** `test_sign_verify_roundtrip`; `test_tampered_id_rejected` (change one char of the ID → `None`); `test_tampered_signature_rejected`; `test_wrong_secret_rejected`; `test_missing_or_malformed_cookie_is_none` (`None`, `""`, `"abc"`); `test_dependency_sets_cookie_once` (first call via a tiny test route sets `lg_workspace` with HttpOnly and SameSite=Lax; a second call with that cookie returns the same ID and sets no new cookie).
- [ ] **Step 2:** `pytest tests/test_workspace.py -q` → FAIL.
- [ ] **Step 3:** Implement `workspace.py` with stdlib `hmac`/`hashlib`/`uuid` (no new dependency).
- [ ] **Step 4:** → PASS.
- [ ] **Step 5:** Commit `billing: signed workspace cookie`.

### Task 3: Stripe client dependency and `POST /billing/checkout`

**Files:**
- Create: `backend/app/billing.py` (an `APIRouter(prefix="/billing")`)
- Modify: `backend/app/main.py` (`app.include_router(billing.router)`), `backend/requirements.txt` (`stripe>=15.6  # Stripe Billing, ADR 0003`)
- Test: `backend/tests/test_billing_checkout.py`; add a `fake_stripe` fixture to `backend/tests/conftest.py`

**Interfaces:**
- Consumes: `lookup_key`, `PLANS` (Task 1); `get_workspace_id` (Task 2).
- Produces: `get_stripe() -> StripeClient` dependency (reads `STRIPE_SECRET_KEY`; raises HTTP 503 "Billing is not configured" if missing or not `sk_test_`/`rk_test_`; `StripeClient(key, stripe_version="2026-08-26.dahlia")`). `POST /billing/checkout` body `{"plan": "starter|professional|enterprise", "interval": "monthly|annual"}` → `200 {"url": str}`; 422 for an unknown plan or interval; 503 when billing isn't configured; 502 "Stripe price not found" if no price matches the lookup key.
- Checkout params (exact): `mode="subscription"`, `line_items=[{"price": <id from prices.list(lookup_keys=[key], active=True)>, "quantity": 1}]`, `subscription_data={"trial_period_days": 14}`, `client_reference_id=workspace_id`, `success_url=f"{origin}/billing/success?session_id={{CHECKOUT_SESSION_ID}}"`, `cancel_url=f"{origin}/pricing"`, `integration_identifier=…`. `origin` comes from the request's `Origin` header, falling back to `PUBLIC_URL` env, then `http://localhost:3000`.
- The `fake_stripe` fixture overrides `get_stripe` via `app.dependency_overrides` with an object exposing `v1.prices.list(params)` and `v1.checkout.sessions.create(params)`; it records params and returns canned objects.

- [ ] **Step 1: Write failing tests:** `test_checkout_returns_stripe_url`; `test_checkout_params` (asserts `mode`, the trial of 14, `client_reference_id` equals the cookie's workspace, `"payment_method_types" not in params`, `integration_identifier` matches `^labelguard-pricing-[a-z]{8}$`, the cancel URL ends `/pricing`); `test_checkout_unknown_plan_422`; `test_checkout_without_key_503` (no override, env unset); `test_live_key_refused_503` (`STRIPE_SECRET_KEY=sk_live_x`); `test_plans_still_ok_with_live_key`; `test_missing_price_502`.
- [ ] **Step 2:** `pytest tests/test_billing_checkout.py -q` → FAIL.
- [ ] **Step 3:** Implement. Check method names against the installed SDK (`python -c "import stripe; print(stripe.VERSION)"`, then the `StripeClient.v1` services).
- [ ] **Step 4:** → PASS; full `pytest -q` stays green.
- [ ] **Step 5:** Commit `billing: Stripe client guard and checkout session`.

### Task 4: Subscription tables and the webhook

**Files:**
- Modify: `backend/app/models.py` (add `Subscription`, `ProcessedEvent`), `backend/app/billing.py`
- Test: `backend/tests/test_billing_webhook.py`

**Interfaces:**
- Produces tables:
  - `subscriptions`: `id` PK; `workspace_id` String(64) **nullable**, unique; `stripe_customer_id` String(255); `stripe_subscription_id` String(255) unique, not null; `plan` String(20) nullable; `billing_interval` String(10) nullable (not `interval`: reserved word in Postgres); `status` String(20) (Stripe status verbatim); `trial_end` DateTime nullable; `current_period_end` DateTime nullable; `payment_failed` Boolean default False; `last_event_created` Integer default 0; `updated_at` DateTime.
  - `processed_events`: `event_id` String(255) PK; `created_at` DateTime.
- `POST /billing/webhook`: reads `await request.body()`, verifies with `stripe.Webhook.construct_event(payload, request.headers["stripe-signature"], STRIPE_WEBHOOK_SECRET)` (does not need the API key, so it works when `get_stripe` would 503). Bad or missing signature → 400. Already-processed `event.id` → 200 `{"status":"duplicate"}`. Unhandled type → 200 `{"status":"ignored"}`.
- Handlers (resolve by Stripe IDs, never metadata):
  - `checkout.session.completed` with `mode == "subscription"`: upsert by `session.subscription`; set `workspace_id = session.client_reference_id` and `stripe_customer_id = session.customer`.
  - `customer.subscription.created|updated|deleted`: skip if `event.created < row.last_event_created`. Upsert by `sub.id`; set `status`, `plan`/`billing_interval` parsed from `items.data[0].price.lookup_key` (`"{plan}_{interval}"`), `trial_end`, `current_period_end` (read from `items.data[0].current_period_end`; on newer API versions it lives on the item), `stripe_customer_id`, `last_event_created = event.created`. A deleted subscription keeps its row with `status="canceled"`.
  - `invoice.payment_failed`: `payment_failed = True` for the row with `invoice.subscription` (or `invoice.parent.subscription_details.subscription` on newer versions; check both). `invoice.paid`: `payment_failed = False`.
- Tests sign payloads themselves: header `t={ts},v1={hmac_sha256(secret, f"{ts}.{body}")}`, using a test secret set via monkeypatched env.

- [ ] **Step 1: Write failing tests:** `test_bad_signature_400`; `test_missing_signature_400`; `test_checkout_completed_links_workspace`; `test_subscription_created_sets_plan_status_trial` (lookup key `professional_monthly` → plan `professional`, billing_interval `monthly`, status `trialing`); **`test_subscription_event_before_checkout_completed`** (subscription first: row with null workspace; then checkout: same row, workspace set; exactly one row); **`test_duplicate_event_is_noop`** (same event twice: one row, second response `duplicate`); **`test_older_event_does_not_overwrite`** (`updated` at created=200 with status `active`, then created=100 with `past_due` → stays `active`); `test_deleted_marks_canceled`; `test_payment_failed_then_paid_toggles_flag`; `test_unhandled_event_ignored_200`.
- [ ] **Step 2:** `pytest tests/test_billing_webhook.py -q` → FAIL.
- [ ] **Step 3:** Implement tables (`create_all` creates the new ones on Neon at the next startup; existing tables are untouched) and the handlers.
- [ ] **Step 4:** → PASS; full suite green.
- [ ] **Step 5:** Commit `billing: subscriptions table and signed webhook`.

### Task 5: `GET /billing/status` and `POST /billing/portal`

**Files:**
- Modify: `backend/app/billing.py`
- Test: `backend/tests/test_billing_status.py`

**Interfaces:**
- Consumes: `Subscription` (Task 4), `get_workspace_id` (Task 2), `get_stripe` (Task 3).
- `GET /billing/status` → `200 {"plan": str|null, "interval": str|null, "status": str|null, "trial_end": iso|null, "current_period_end": iso|null, "payment_failed": bool}` for the cookie's workspace. No row → all null and `payment_failed: false` (never 404). Works without a Stripe key.
- `POST /billing/portal` → `200 {"url": str}` via `v1.billing_portal.sessions.create({"customer": row.stripe_customer_id, "return_url": f"{origin}/pricing"})`; 404 "No subscription for this workspace" when there's no row; 503 when not configured.

- [ ] **Step 1: Write failing tests:** **`test_status_before_webhook_is_empty_not_error`**; `test_status_after_webhook` (insert a row for the cookie's workspace → plan returned); **`test_status_ignores_other_workspaces`** (a row for workspace A; a request with B's cookie → null); `test_portal_without_subscription_404`; `test_portal_returns_url_for_own_customer` (fake records `customer` equal to the row's customer); **`test_tampered_cookie_cannot_open_other_portal`** (A's row; a cookie with A's ID and a bad signature → 404, and a fresh cookie is set).
- [ ] **Step 2:** → FAIL. **Step 3:** Implement. **Step 4:** → PASS.
- [ ] **Step 5:** Commit `billing: status and customer portal`.

### Task 6: Contract, docs and the pricing E2E check

**Files:**
- Modify: `docs/api-contract.md` (new "Billing" section with the five routes and shapes above), `docs/deployment.md` (env vars `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `WORKSPACE_SECRET`, `PUBLIC_URL`; webhook URL; "test mode only"), `docs/architecture.md` (billing flow and link to ADRs 0003/0004), `docs/qa-test-plan.md` (Billing section: 4242 4242 4242 4242 success, 4000 0025 0000 3155 3-D Secure, 4000 0000 0000 0341 payment fails after trial, cancel via portal, return before webhook), `AGENTS.md` ownership (`backend/app/billing.py`, `plans.py`, `workspace.py` → Amzad; `/pricing`, `/billing/*` pages → Wenyi)
- Test: `tests/e2e/test_e2e.py`, add `test_plans_catalog` (read-only: 3 plans, monthly cents `[4900, 14900, 49900]`), so it also runs against production.

- [ ] **Step 1:** Write `test_plans_catalog`; run it against a local server → PASS (Task 1 exists).
- [ ] **Step 2:** Write the docs.
- [ ] **Step 3:** Commit `billing: contract, deployment, QA docs, E2E plans check`.

### Task 7: Provision Stripe (human steps marked [HUMAN])

**Files:**
- Create: `backend/scripts/stripe_setup.py` (idempotent: ensures 3 Products, 6 Prices with `lookup_key` and `transfer_lookup_key=True`, a Customer Portal configuration allowing plan switching between the 6 prices, cancellation, and payment-method updates, and the webhook endpoint `https://ai-product-label-verification.vercel.app/api/billing/webhook` with the six event types). It reads the key from the `STRIPE_SECRET_KEY` env var or `--env-file <path>`, refuses non-test keys, and writes the new endpoint's signing secret to Vercel with `vercel env add STRIPE_WEBHOOK_SECRET production` via stdin. **It never prints a secret.**

- [ ] **Step 1 [HUMAN]:** `vercel integration add stripe`, then accept the terms in the browser when prompted, choosing a **sandbox** (test mode).
- [ ] **Step 2:** `vercel env ls` shows the Stripe key names (names only). If the integration's key variable isn't `STRIPE_SECRET_KEY`, map it in `get_stripe()` and the docs. Prefer a **restricted key** for runtime (Checkout Sessions write, Prices read, Customer portal write, Subscriptions read), added as `STRIPE_SECRET_KEY` for Production and Preview.
- [ ] **Step 3:** `vercel env add WORKSPACE_SECRET production` with a random 32-byte hex value (generated by the command that pipes it, never echoed).
- [ ] **Step 4 [HUMAN or agent with explicit OK]:** `vercel env pull .env.stripe --environment=production` (git-ignored by `.env.*`), then `python backend/scripts/stripe_setup.py --env-file .env.stripe`, then delete `.env.stripe`. Expected output: Product, Price and endpoint IDs only.
- [ ] **Step 5:** Re-run the script → "already exists" for everything (idempotent).
- [ ] **Step 6:** Commit `billing: idempotent Stripe catalog/portal/webhook setup script`.

### Task 8: Frontend `/pricing` and the nav link

**Files:**
- Modify: `frontend/src/lib/api.ts` (add types `Plan`, `BillingStatus`; `api.plans()`, `api.startCheckout(plan, interval)` → `{url}`, `api.billingStatus()`, `api.openPortal()` → `{url}`; requests use `credentials: "include"`)
- Create: `frontend/src/app/pricing/page.tsx`
- Modify: `frontend/src/components/Sidebar.tsx` (`NAV_ITEMS`: add `{ href: "/pricing", label: "Pricing", icon: <CreditCard …/> }` after History; the home marketing header reuses `NAV_ITEMS`, so Pricing appears there too)

**Interfaces:**
- Consumes: `GET /plans`, `POST /billing/checkout` (Tasks 1, 3).
- Page: a monthly/annual toggle (annual shows "2 months free" and the annual price ÷ 12 as "/mo, billed annually"); three cards with name, price, the three limits ("Unlimited" for null), and the Pass/Needs Review + OCR confidence lines; Professional has the "Most popular" badge; the button "Start 14-day trial" calls `startCheckout` and then `window.location.assign(url)`. On 503, show inline "Billing isn't set up yet."; on other errors, "Couldn't start checkout. Try again.". The footer line reads "Test mode: use card 4242 4242 4242 4242." Uses the existing navy/Tailwind tokens from Wenyi's redesign.

- [ ] **Step 1:** Implement the api functions and the page.
- [ ] **Step 2:** `cd frontend && npm run lint && npm run build` → pass; `/pricing` appears in the route list.
- [ ] **Step 3:** Run locally (`uvicorn` :8000 + `npm run dev`). `/pricing` shows the 3 cards and the annual toggle changes the prices. Clicking a button without a Stripe key shows "Billing isn't set up yet."
- [ ] **Step 4:** Commit `frontend: pricing page and nav link`.

### Task 9: Frontend `/billing/success` and the plan badge

**Files:**
- Create: `frontend/src/app/billing/success/page.tsx`, `frontend/src/components/PlanBadge.tsx`
- Modify: `frontend/src/components/Sidebar.tsx` (render `<PlanBadge />` above the nav footer)

**Interfaces:**
- Consumes: `api.billingStatus()`, `api.openPortal()` (Task 8).
- Success page: polls `billingStatus()` every 2 s for up to 30 s. While `plan` is null it shows "Confirming your subscription…". When set: "You're on {Name}. Trial ends {date}." plus links to Inspect and Manage billing. After 30 s: "Stripe hasn't confirmed yet. This page will update, or check back in a minute." (not an error state). Never reads `session_id` to decide success.
- PlanBadge: hidden when `plan` is null. Otherwise shows "{Name} · Trial" or "{Name}", plus a "Manage billing" button → `openPortal()` → redirect. When `payment_failed`: an amber "Payment failed: update your card" line linking to the portal.

- [ ] **Step 1:** Implement.
- [ ] **Step 2:** `npm run lint && npm run build` → pass.
- [ ] **Step 3:** Commit `frontend: billing success page and plan badge`.

### Task 10: End-to-end verification and the demo script

- [ ] **Step 1:** Local: `stripe listen --forward-to localhost:8000/billing/webhook` (sets a local `STRIPE_WEBHOOK_SECRET`), then a full checkout with 4242 → the success page flips to the plan within seconds → the sidebar badge shows "Professional · Trial" → the portal opens.
- [ ] **Step 2:** `stripe trigger invoice.payment_failed` → the badge shows the amber warning; `stripe trigger invoice.paid` → it clears.
- [ ] **Step 3:** PR `feature/billing-stripe` → main: all required checks green; Amzad reviews backend, Wenyi reviews frontend. Merge.
- [ ] **Step 4:** Production: the post-deploy check passes (now including `test_plans_catalog`). One real test-mode checkout on the live site with 4242; the Stripe Dashboard → Webhooks shows the deliveries succeeded (2xx).
- [ ] **Step 5:** Update `docs/presentation.md` and `docs/demo-readiness.md` with a pricing step: open Pricing → toggle annual → Start trial (Professional) → card 4242 → success page confirms → badge → Manage billing. The talking point is "Stripe handles payments, renewals and cancellation; our webhook is the single source of plan state."
- [ ] **Step 6:** Append the AI-usage line to `docs/ai-usage.md`; commit.

## Cut line (if time runs short before the Oct 19 freeze)
Keep Tasks 1–8 and the success page from Task 9. Cut, in this order: the payment-failed badge state, the portal button (link to Stripe's hosted portal from the success page instead), and the annual toggle (monthly only, with annual Prices still created).
