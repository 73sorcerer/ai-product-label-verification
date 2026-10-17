# 0003: Three-tier pricing with Stripe Billing (test mode)

- **Date:** 2026-10-17
- **Status:** Accepted (not yet built; see [the plan](../superpowers/plans/2026-10-17-pricing-stripe.md))
- **Approved by:** Tray (Technical Lead)

## Context
The professor asked for a pricing model with three levels, wired to Stripe. The app has no user accounts (see [0004](0004-workspace-identity-now-clerk-later.md)). The demo is Oct 20; code freeze is Oct 19.

### Market research (Oct 17)
| Product | What it does | Published price |
|---|---|---|
| GlobalVision Verify | Enterprise label/artwork inspection | Custom quote, annual license, 14-day trial |
| IMERO | Food/cosmetic label compliance | Contact vendor |
| Artwork Flow | AI artwork compliance | From ~$8,000/year (~$667/month), volume-based |
| GoVisually | Proofing/approval | $16/user/month |
| ArtworkFlow (per fitgap) | Artwork workflow | $30/user/month |
| Food Label Maker | Food label creation | From $49/month (Essential / Pro / Business, Enterprise on request) |

**Gap:** per-seat proofing tools compare documents but don't verify labels; label-inspection vendors only sell through sales calls. Small and mid-size brands and co-packers have no self-serve option.

Sources: [GlobalVision pricing](https://globalvision.co/pricing), [Capterra: GlobalVision](https://www.capterra.com/p/69038/DOCU-PROOF-C3/), [Software Finder: Artwork Flow](https://softwarefinder.com/project-management-software/artwork-flow), [GoVisually: 5 best labeling tools](https://govisually.com/blog/5-best-packaging-labeling-workflow-approval-tools-in-2025), [fitgap: ArtworkFlow](https://us.fitgap.com/products/027543/artworkflow), [Capterra: Food Label Maker](https://www.capterra.com/p/10013353/Food-Label-Maker/reviews/), [Capterra: IMERO](https://www.capterra.com/p/10045880/IMERO/). Prices from aggregator listings may be out of date.

## Decision

### Pricing: charge by labels inspected, not per user
QA teams share one inspection station, and inspection volume is what grows with the value delivered.

| | Starter | Professional | Enterprise |
|---|---|---|---|
| Plan id | `starter` | `professional` | `enterprise` |
| Monthly | $49 | $149 | $499 |
| Annual (2 months free) | $490 | $1,490 | $4,990 |
| Inspections / month | 200 | 1,000 | Unlimited |
| Saved specs | 10 | Unlimited | Unlimited |
| History kept | 90 days | 1 year | Unlimited |
| Highlight | | "Most popular" | |

- 14-day free trial on every plan. All three plans go through Stripe.
- **Limits are displayed, not enforced** (decided Oct 17). Enforcement comes after accounts exist.
- Tax: Stripe Tax is **off**. Test mode only, and there's no tax registration, so enabling `automatic_tax` would collect nothing while implying it does.

### Stripe integration
- **Stripe sandbox** provisioned through the Vercel Marketplace (`vercel integration add stripe`). Keys live only in Vercel env vars, never in the repo.
- **Test mode only.** The backend refuses to start billing with a key that isn't `sk_test_…` or `rk_test_…`.
- **Catalog:** one Stripe Product per plan (Stripe's guidance: never put two tiers on one Product), each with a monthly and an annual Price. Prices are found by `lookup_key` (`starter_monthly` … `enterprise_annual`), not hard-coded IDs.
- **Checkout Sessions** with `mode=subscription`, `subscription_data.trial_period_days=14`, no `payment_method_types` (dynamic payment methods), and `integration_identifier`.
- **Webhook** (`POST /api/billing/webhook`) is the only writer of subscription state. It verifies the signature on the raw body, deduplicates by event ID, and ignores events older than the stored state. Events: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
- **Customer Portal** for upgrades, downgrades, cancellation and card changes.
- The success page never trusts the redirect: it shows "Confirming…" until the webhook has recorded the subscription.

## Consequences
- **Easier:** no card handling in our code; renewals, retries and proration are Stripe's job; the full flow demos with test card 4242 4242 4242 4242.
- **Harder:** a third external service; webhook delivery only reaches production (previews are behind Vercel login), so local development uses `stripe listen`.
- **Revisit when:** accounts exist (0004), then enforce limits, and move to live mode only after a tax decision.
