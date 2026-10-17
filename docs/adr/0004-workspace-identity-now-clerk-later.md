# 0004: Workspace cookie for billing now; Clerk Organizations when this becomes a product

- **Date:** 2026-10-17
- **Status:** Accepted
- **Approved by:** Tray (Technical Lead)

## Context
A subscription must belong to someone, but the app has no accounts: every visitor sees the same specs and inspections. If VeriLabel becomes a real product, the buyer is a **QA team**, not an individual.

## Decision

**Product target: Clerk with Organizations.** Clerk is Vercel's recommended login provider and installs through the Marketplace (`vercel integration add clerk`), like Neon and Stripe. The subscription belongs to the **organization**: one Stripe customer per organization, and every spec and inspection carries an `org_id`.

**For the Oct 20 demo: a signed workspace cookie.**
- The first billing request creates a random `workspace_id` and stores it in an HttpOnly, SameSite=Lax cookie (`lg_workspace`), signed with HMAC-SHA256 using `WORKSPACE_SECRET`.
- Checkout passes `workspace_id` as `client_reference_id`, a first-class Checkout field, so the webhook links the Stripe subscription to the workspace without relying on metadata.
- The `subscriptions` table is keyed by `workspace_id`.
- Specs and inspections stay shared (unchanged).

## Migration to Clerk (after the demo)
1. `vercel integration add clerk`; add `<ClerkProvider>`, `proxy.ts`, and sign-in pages with Organizations enabled.
2. The backend verifies Clerk session tokens (JWKS) and reads the active `org_id`.
3. Replace the cookie dependency `get_workspace_id()` with one returning the Clerk `org_id`. **Billing code, Stripe objects and the `subscriptions` table don't change.**
4. Add `org_id` to `product_specs` and `inspections` (an additive migration) and filter every query by it.
5. Enforce plan limits (0003) per organization.

## Consequences
- **Easier now:** no login screen in the live demo; no change to Amzad's routes or tests.
- **Limitation (say it in the demo):** the subscription is tied to the browser. Clearing cookies or switching devices loses the link, though Stripe still has the subscription.
- **Revisit when:** the project continues past the course, then do the migration above first.
