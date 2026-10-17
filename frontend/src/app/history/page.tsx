"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api, friendlyErrorMessage, type Inspection } from "@/lib/api";
import { InspectionBadge } from "@/components/StatusBadge";

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function HistoryPage() {
  const [inspections, setInspections] = useState<Inspection[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setInspections(await api.listInspections());
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await api.listInspections();
        if (!cancelled) setInspections(data);
      } catch (err) {
        if (!cancelled) setError(friendlyErrorMessage(err));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Inspection history</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Newest first.
        </p>
      </div>

      {loading && <p className="text-sm text-zinc-500">Loading…</p>}
      {error && (
        <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
          {error}{" "}
          <button onClick={() => void load()} className="underline">
            Retry
          </button>
        </div>
      )}
      {!loading && !error && inspections.length === 0 && (
        <p className="text-sm text-zinc-500">
          No inspections yet —{" "}
          <Link href="/inspect" className="underline">
            run one
          </Link>
          .
        </p>
      )}
      <ul className="space-y-3">
        {inspections.map((insp) => (
          <li key={insp.id}>
            <Link
              href={`/history/${insp.id}`}
              className="flex items-center justify-between gap-4 rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 dark:border-zinc-800 dark:hover:bg-zinc-900"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">
                  {insp.image_filename}
                </p>
                <p className="text-xs text-zinc-500">
                  #{insp.id} · spec #{insp.spec_id} ·{" "}
                  {formatDate(insp.created_at)}
                </p>
              </div>
              <InspectionBadge status={insp.status} />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
