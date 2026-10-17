"use client";
import type { InspectionRecord } from "@/lib/mock-data";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  api,
  friendlyErrorMessage,
  
  type ProductSpec,
} from "@/lib/api";
import { InspectionBadge } from "@/components/StatusBadge";

const PAGE_SIZE = 8;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function avatarColor(name: string): string {
  const palette = [
    "bg-[#e3f2f0] text-[#0b666b]",
    "bg-[#fdf0dc] text-[#b45309]",
    "bg-[#e7f0fd] text-[#2b5cab]",
    "bg-[#f3e8f5] text-[#7e3aa8]",
    "bg-[#fdecec] text-[#c22727]",
    "bg-[#e7f6ec] text-[#15803d]",
  ];
  let h = 0;
  for (const c of name) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return palette[h % palette.length];
}

function initials(name: string): string {
  const words = name.trim().split(/\s+/);
  const first = words[0]?.[0] ?? "?";
  const second = words.length > 1 ? (words[1]?.[0] ?? "") : "";
  return (first + second).toUpperCase();
}

function issueCount(insp: InspectionRecord): number {
  return insp.results.filter((r) => r.status !== "match").length;
}

export default function HistoryPage() {
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [specs, setSpecs] = useState<ProductSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [range, setRange] = useState<"all" | "7d" | "30d">("all");
  const [page, setPage] = useState(0);
  // Cutoff timestamp for the time filter; 0 = all time. Set from the
  // select's change handler so no clock is read during render/prerender.
  const [cutoff, setCutoff] = useState(0);

  const specNames = useMemo(() => {
    const m = new Map<number, string>();
    for (const s of specs) m.set(s.id, s.name);
    return m;
  }, [specs]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [inspList, specList] = await Promise.all([
        api.listInspections(),
        api.listSpecs().catch(() => [] as ProductSpec[]),
      ]);
      setInspections(inspList);
      setSpecs(specList);
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
        const [inspList, specList] = await Promise.all([
          api.listInspections(),
          api.listSpecs().catch(() => [] as ProductSpec[]),
        ]);
        if (cancelled) return;
        setInspections(inspList);
        setSpecs(specList);
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return inspections.filter((insp) => {
      const t = new Date(insp.created_at).getTime();
      if (cutoff && !(t >= cutoff)) return false;
      if (!q) return true;
      const specName = specNames.get(insp.spec_id) ?? "";
      return (
        insp.image_filename.toLowerCase().includes(q) ||
        specName.toLowerCase().includes(q) ||
        insp.status.replace("_", " ").includes(q)
      );
    });
  }, [inspections, specNames, query, cutoff]);

  const stats = useMemo(
    () => ({
      total: inspections.length,
      pass: inspections.filter((i) => i.status === "pass").length,
      needsReview: inspections.filter((i) => i.status === "needs_review")
        .length,
    }),
    [inspections]
  );

  const pageCount = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filtered.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE
  );

  const productName = (insp: InspectionRecord) =>
    specNames.get(insp.spec_id) ?? insp.image_filename;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Inspection history
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            View past inspections and their results.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-500" aria-hidden="true">
              <circle cx="9" cy="9" r="5.5" />
              <path strokeLinecap="round" d="M13.5 13.5 17 17" />
            </svg>
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setPage(0);
              }}
              placeholder="Search products or inspections…"
              aria-label="Search inspections"
              className="rounded-xl border border-mist-200 bg-white py-2.5 pl-9 pr-3.5 text-sm outline-none transition-colors placeholder:text-ink-500/60 focus:border-brand-600"
            />
          </div>
          <select
            value={range}
            onChange={(e) => {
              const v = e.target.value as "all" | "7d" | "30d";
              setRange(v);
              setCutoff(
                v === "all" ? 0 : Date.now() - (v === "7d" ? 7 : 30) * 86400000
              );
              setPage(0);
            }}
            aria-label="Time range"
            className="rounded-xl border border-mist-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand-600"
          >
            <option value="all">All time</option>
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
          </select>
        </div>
      </div>

      {loading && <p className="text-sm text-ink-500">Loading…</p>}
      {error && (
        <div className="card border-[#f5d9a8] bg-[#fffaf0] p-4 text-sm text-[#9a4a0a]">
          {error}{" "}
          <button onClick={() => void load()} className="font-semibold underline">
            Retry
          </button>
        </div>
      )}

      {!loading && !error && (
        <>
          {inspections.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="font-semibold text-navy-900">
                No inspections yet
              </p>
              <p className="mt-1 text-sm text-ink-600">
                Run your first inspection to start building history.
              </p>
              <Link
                href="/inspect"
                className="mt-4 inline-block rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
              >
                New inspection
              </Link>
            </div>
          ) : (
            <>
              {/* Stat cards — computed from real loaded data only */}
              <div className="grid grid-cols-3 gap-3">
                <div className="card p-4 text-center sm:p-5">
                  <p className="text-3xl font-bold tabular-nums text-navy-900">
                    {stats.total}
                  </p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-500">
                    Total inspections
                  </p>
                </div>
                <div className="card p-4 text-center sm:p-5">
                  <p className="text-3xl font-bold tabular-nums text-[#15803d]">
                    {stats.pass}
                  </p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-500">
                    Pass
                  </p>
                </div>
                <div className="card p-4 text-center sm:p-5">
                  <p className="text-3xl font-bold tabular-nums text-[#b45309]">
                    {stats.needsReview}
                  </p>
                  <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-500">
                    Needs review
                  </p>
                </div>
              </div>

              <section className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[720px] text-left text-sm">
                    <thead>
                      <tr className="border-b border-mist-200 text-xs uppercase tracking-wide text-ink-500">
                        <th className="px-5 py-3.5 font-semibold">Date</th>
                        <th className="px-5 py-3.5 font-semibold">Product</th>
                        <th className="px-5 py-3.5 font-semibold">Result</th>
                        <th className="px-5 py-3.5 font-semibold">Issues</th>
                        <th className="px-5 py-3.5 font-semibold">
                          <span className="sr-only">Actions</span>
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {pageRows.map((insp) => {
                        const name = productName(insp);
                        const issues = issueCount(insp);
                        return (
                          <tr
                            key={insp.id}
                            className="border-t border-mist-100 transition-colors first:border-t-0 hover:bg-mist-50/70"
                          >
                            <td className="whitespace-nowrap px-5 py-3.5 text-ink-600">
                              {formatDate(insp.created_at)}
                            </td>
                            <td className="px-5 py-3.5">
                              <span className="flex items-center gap-2.5">
                                <span
                                  className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${avatarColor(name)}`}
                                  aria-hidden="true"
                                >
                                  {initials(name)}
                                </span>
                                <span className="font-medium text-navy-900">
                                  {name}
                                </span>
                              </span>
                            </td>
                            <td className="px-5 py-3.5">
                              <InspectionBadge status={insp.status} />
                            </td>
                            <td className="px-5 py-3.5 tabular-nums text-ink-600">
                              {issues}
                            </td>
                            <td className="px-5 py-3.5 text-right">
                              <Link
                                href={`/history/${insp.id}`}
                                className="font-semibold text-brand-700 underline-offset-4 hover:underline"
                              >
                                View
                              </Link>
                            </td>
                          </tr>
                        );
                      })}
                      {pageRows.length === 0 && (
                        <tr>
                          <td
                            colSpan={5}
                            className="px-5 py-10 text-center text-sm text-ink-500"
                          >
                            No inspections match your search.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-mist-200 px-5 py-3.5 text-sm text-ink-500">
                  <p>
                    Showing{" "}
                    {filtered.length === 0
                      ? 0
                      : safePage * PAGE_SIZE + 1}
                    –{Math.min(
                      filtered.length,
                      safePage * PAGE_SIZE + PAGE_SIZE
                    )}{" "}
                    of {filtered.length} inspections
                  </p>
                  {pageCount > 1 && (
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        disabled={safePage === 0}
                        onClick={() => setPage(safePage - 1)}
                        aria-label="Previous page"
                        className="rounded-lg border border-mist-200 px-2.5 py-1.5 disabled:opacity-40"
                      >
                        ‹
                      </button>
                      {Array.from({ length: pageCount }, (_, i) => (
                        <button
                          key={i}
                          type="button"
                          onClick={() => setPage(i)}
                          aria-label={`Page ${i + 1}`}
                          aria-current={i === safePage ? "page" : undefined}
                          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
                            i === safePage
                              ? "bg-navy-900 text-white"
                              : "border border-mist-200 text-ink-600"
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                      <button
                        type="button"
                        disabled={safePage === pageCount - 1}
                        onClick={() => setPage(safePage + 1)}
                        aria-label="Next page"
                        className="rounded-lg border border-mist-200 px-2.5 py-1.5 disabled:opacity-40"
                      >
                        ›
                      </button>
                    </div>
                  )}
                </div>
              </section>
            </>
          )}
        </>
      )}
    </div>
  );
}
