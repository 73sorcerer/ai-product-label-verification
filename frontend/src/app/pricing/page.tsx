"use client";
// Pricing (ADR 0003): three plans through Stripe Checkout, test mode only. Limits are displayed, not enforced.
import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import { ApiError, api, friendlyErrorMessage, type BillingInterval, type BillingStatus, type Plan, type PlanId } from "@/lib/api";

const dollars = (cents: number) => `$${(cents / 100).toLocaleString("en-US", { minimumFractionDigits: cents % 100 ? 2 : 0, maximumFractionDigits: 2 })}`;
const limit = (n: number | null, unit: string) => (n === null ? `Unlimited ${unit}` : `${n.toLocaleString("en-US")} ${unit}`);
const history = (days: number | null) => (days === null ? "Unlimited history" : days >= 365 ? `${days / 365} year of history` : `${days} days of history`);

export default function PricingPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [interval, setBillingInterval] = useState<BillingInterval>("monthly");
  const [busy, setBusy] = useState<PlanId | "portal" | null>(null);
  const [error, setError] = useState("");
  const [alreadySubscribed, setAlreadySubscribed] = useState(false);

  useEffect(() => {
    let active = true;
    api.plans().then(p => { if (active) setPlans(p); }).catch(e => { if (active) setError(friendlyErrorMessage(e)); });
    api.billingStatus().then(s => { if (active) setStatus(s); }).catch(() => { /* status is optional on this page */ });
    return () => { active = false; };
  }, []);

  const current = status?.plan && status.status !== "canceled" ? status.plan : null;

  async function start(plan: PlanId) {
    setError(""); setAlreadySubscribed(false); setBusy(plan);
    try {
      const { url } = await api.startCheckout(plan, interval);
      window.location.assign(url);
    } catch (e) {
      if (e instanceof ApiError && e.status === 503) setError("Billing isn't set up yet.");
      else if (e instanceof ApiError && e.status === 409) { setError(e.message); setAlreadySubscribed(true); }
      else setError("Couldn't start checkout. Try again.");
      setBusy(null);
    }
  }

  async function manage() {
    setError(""); setBusy("portal");
    try { window.location.assign((await api.openPortal()).url); }
    catch (e) { setError(friendlyErrorMessage(e)); setBusy(null); }
  }

  return <div className="space-y-6">
    <div className="page-heading"><div><h1>Pricing</h1><p>Every plan starts with a 14-day free trial. Plans differ by how many labels you inspect.</p></div></div>

    <div role="group" aria-label="Billing interval" className="inline-flex rounded-lg border border-mist-200 bg-white p-1 text-sm">
      {(["monthly", "annual"] as const).map(i => <button key={i} type="button" aria-pressed={interval === i} onClick={() => setBillingInterval(i)}
        className={`rounded-md px-4 py-1.5 font-medium transition-colors ${interval === i ? "bg-navy-900 text-white" : "text-ink-600 hover:bg-mist-50"}`}>
        {i === "monthly" ? "Monthly" : <>Annual <span className={interval === i ? "text-[#7fe0ea]" : "text-brand-600"}>· 2 months free</span></>}
      </button>)}
    </div>

    {error && <div role="alert" className="flex flex-wrap items-center gap-3 rounded-lg border border-[#f5d9a8] bg-[#fdf6ea] px-4 py-3 text-sm text-[#8a4b06]">
      <span>{error}</span>
      {alreadySubscribed && <button type="button" className="outline-button" onClick={() => void manage()}>Manage billing</button>}
    </div>}

    <div className="grid gap-5 md:grid-cols-3">
      {plans.map(p => {
        const isCurrent = current === p.id;
        const perMonth = interval === "monthly" ? p.monthly_cents : Math.round(p.annual_cents / 12);
        return <section key={p.id} aria-labelledby={`plan-${p.id}`}
          className={`relative flex flex-col rounded-xl border bg-white p-6 shadow-[0_1px_2px_rgba(15,30,51,0.06)] ${p.highlight ? "border-brand-600 ring-1 ring-brand-600" : "border-mist-200"}`}>
          {p.highlight && <span className="absolute -top-3 left-6 rounded-full bg-brand-600 px-3 py-0.5 text-xs font-semibold text-white">Most popular</span>}
          <h2 id={`plan-${p.id}`} className="text-lg font-semibold text-ink-900">{p.name}</h2>
          <p className="mt-3 flex items-baseline gap-1 tabular-nums"><span className="text-4xl font-bold tracking-tight text-ink-900">{dollars(perMonth)}</span><span className="text-sm text-ink-500">/mo</span></p>
          <p className="mt-1 h-5 text-xs text-ink-500 tabular-nums">{interval === "annual" ? `${dollars(p.annual_cents)} billed annually` : "billed monthly"}</p>
          <ul className="mt-5 flex-1 space-y-2.5 text-sm text-ink-600">
            {[limit(p.inspections_per_month, "inspections / month"), limit(p.saved_specs, "saved specs"), history(p.history_days),
              "Pass / Needs Review per field", "OCR confidence flags"].map(f => <li key={f} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-brand-600" aria-hidden="true" />{f}</li>)}
          </ul>
          {isCurrent
            ? <button type="button" className="outline-button mt-6 w-full" disabled={busy !== null} onClick={() => void manage()}>{busy === "portal" ? "Opening…" : "Current plan · Manage billing"}</button>
            : <button type="button" className={`${p.highlight ? "primary-button" : "outline-button"} mt-6 w-full`} disabled={busy !== null} onClick={() => void start(p.id)}>{busy === p.id ? "Opening checkout…" : `Start ${p.trial_days}-day trial`}</button>}
        </section>;
      })}
    </div>
    {!plans.length && !error && <p className="text-sm text-ink-500">Loading plans…</p>}

    <p className="text-xs text-ink-500">Test mode: no real charges. Use card 4242 4242 4242 4242, any future date, any CVC. Prices in USD; tax not included. Plan limits are shown for comparison and aren&apos;t enforced yet.</p>
  </div>;
}
