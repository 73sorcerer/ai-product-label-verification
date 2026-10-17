"use client";
// Never decide success from the redirect or session_id: wait until the webhook has recorded the
// subscription (GET /billing/status). Stripe usually confirms within seconds.
import Link from "next/link";
import { useEffect, useState } from "react";
import { api, friendlyErrorMessage, type BillingStatus } from "@/lib/api";

const POLL_MS = 2000;
const GIVE_UP_MS = 30000;
const NAMES = { starter: "Starter", professional: "Professional", enterprise: "Enterprise" } as const;

export default function BillingSuccessPage() {
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    const started = Date.now();
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      try {
        const s = await api.billingStatus();
        if (!active) return;
        if (s.plan) { setStatus(s); return; }
      } catch (e) { if (active) setError(friendlyErrorMessage(e)); }
      if (Date.now() - started > GIVE_UP_MS) setSlow(true);
      timer = setTimeout(poll, POLL_MS);  // keep checking even after "slow": the page updates when Stripe confirms
    }
    void poll();
    return () => { active = false; clearTimeout(timer); };
  }, []);

  async function manage() {
    try { window.location.assign((await api.openPortal()).url); } catch (e) { setError(friendlyErrorMessage(e)); }
  }

  const trialEnds = status?.trial_end ? new Date(status.trial_end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" }) : null;

  return <div className="mx-auto max-w-xl space-y-5 py-10 text-center" aria-live="polite">
    {status?.plan ? <>
      <h1 className="text-3xl font-bold tracking-tight text-ink-900">You&apos;re on {NAMES[status.plan]}</h1>
      <p className="text-ink-600">{trialEnds ? `Your free trial ends ${trialEnds}.` : "Your subscription is active."} Manage or cancel it anytime.</p>
      <div className="flex flex-wrap justify-center gap-3">
        <Link href="/inspect" className="primary-button">Inspect a label</Link>
        <button type="button" className="outline-button" onClick={() => void manage()}>Manage billing</button>
      </div>
    </> : <>
      <h1 className="text-2xl font-semibold text-ink-900">Confirming your subscription…</h1>
      <p className="text-ink-600">{slow ? "Stripe hasn't confirmed yet. This page will update on its own, or check back in a minute." : "This usually takes a few seconds."}</p>
    </>}
    {error && <p role="alert" className="text-sm text-[#8a4b06]">{error}</p>}
  </div>;
}
