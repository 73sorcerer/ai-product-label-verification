"use client";
// Sidebar plan badge: hidden until this workspace has a subscription (GET /billing/status).
import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { api, type BillingStatus } from "@/lib/api";

const NAMES = { starter: "Starter", professional: "Professional", enterprise: "Enterprise" } as const;

export default function PlanBadge() {
  const pathname = usePathname();
  const [status, setStatus] = useState<BillingStatus | null>(null);
  const [opening, setOpening] = useState(false);

  useEffect(() => {  // refresh on navigation, e.g. coming back from the success page or the portal
    let active = true;
    api.billingStatus().then(s => { if (active) setStatus(s); }).catch(() => { /* badge is optional */ });
    return () => { active = false; };
  }, [pathname]);

  if (!status?.plan || status.status === "canceled") return null;

  async function manage() {
    setOpening(true);
    try { window.location.assign((await api.openPortal()).url); } catch { setOpening(false); }
  }

  return <div className="mx-2 mb-3 rounded-xl border border-navy-800 bg-navy-950/40 p-3 text-sm text-white">
    <p className="font-medium">{NAMES[status.plan]}{status.status === "trialing" ? " · Trial" : ""}</p>
    {status.payment_failed && <p className="mt-1 text-xs text-[#ffcf8a]">Payment failed: update your card</p>}
    <button type="button" onClick={() => void manage()} disabled={opening}
      className="mt-2 text-xs font-medium text-[#7fe0ea] underline-offset-2 hover:underline disabled:opacity-60">
      {opening ? "Opening…" : "Manage billing"}
    </button>
  </div>;
}
