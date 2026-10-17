"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api, friendlyErrorMessage, type Inspection } from "@/lib/api";
import InspectionDetail from "@/components/InspectionDetail";

export default function InspectionDetailView({ id }: { id: string }) {
  const [inspection, setInspection] = useState<Inspection | null>(null);
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
        className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
      >
        ← Back to history
      </Link>
      <h1 className="text-2xl font-bold">Inspection #{id}</h1>
      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && (
        <p className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          {error}
        </p>
      )}
      {inspection && <InspectionDetail inspection={inspection} />}
    </div>
  );
}
