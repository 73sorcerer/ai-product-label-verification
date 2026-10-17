"use client";
import type { InspectionRecord } from "@/lib/mock-data";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, friendlyErrorMessage } from "@/lib/api";
import InspectionDetail from "@/components/InspectionDetail";

export default function InspectionDetailView({ id }: { id: string }) {
  const [inspection, setInspection] = useState<InspectionRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const numericId = Number(id);
      if (!Number.isInteger(numericId)) {
        setError("Invalid inspection id.");
        setLoading(false);
        return;
      }
      try {
        const data = await api.getInspection(numericId);
        if (!cancelled) setInspection(data);
      } catch (err) {
        if (!cancelled) setError(friendlyErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <div className="space-y-6">
      <Link
        href="/history"
        className="text-sm font-medium text-brand-700 underline-offset-4 hover:underline"
      >
        ← Back to history
      </Link>
      <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
        Inspection #{id}
      </h1>
      {loading && <p className="text-sm text-ink-500">Loading…</p>}
      {error && (
        <p className="rounded-xl border border-[#f5d9a8] bg-[#fffaf0] px-4 py-3 text-sm text-[#9a4a0a]">
          {error}
        </p>
      )}
      {inspection && <InspectionDetail inspection={inspection} />}
    </div>
  );
}

