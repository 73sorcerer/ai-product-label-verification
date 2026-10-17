"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { api, friendlyErrorMessage, type ProductSpec } from "@/lib/api";

type FieldRow = { key: string; value: string };

function emptyRow(): FieldRow {
  return { key: "", value: "" };
}

const FIELD_SUGGESTIONS = [
  "Product Name",
  "Net Weight",
  "Ingredients",
  "Allergens",
  "Brand",
  "Barcode",
];

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
}

/** Deterministic pastel avatar color from a name. */
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

export default function SpecsPage() {
  const [specs, setSpecs] = useState<ProductSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);

  const [name, setName] = useState("");
  const [rows, setRows] = useState<FieldRow[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.listSpecs();
      setSpecs(data);
      setSelectedId((cur) =>
        cur !== null && data.some((s) => s.id === cur)
          ? cur
          : (data[0]?.id ?? null)
      );
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
        const data = await api.listSpecs();
        if (cancelled) return;
        setSpecs(data);
        setSelectedId(data[0]?.id ?? null);
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
    if (!q) return specs;
    return specs.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        Object.entries(s.fields).some(
          ([k, v]) =>
            k.toLowerCase().includes(q) || v.toLowerCase().includes(q)
        )
    );
  }, [specs, query]);

  const selected = specs.find((s) => s.id === selectedId) ?? null;

  const updateRow = (i: number, patch: Partial<FieldRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const removeRow = (i: number) =>
    setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs));

  const addSuggestion = (suggestion: string) =>
    setRows((rs) => {
      if (rs.some((r) => r.key.trim().toLowerCase() === suggestion.toLowerCase()))
        return rs;
      const last = rs[rs.length - 1];
      const next = [...rs];
      if (last && !last.key.trim() && !last.value.trim()) {
        next[next.length - 1] = { key: suggestion, value: "" };
      } else {
        next.push({ key: suggestion, value: "" });
      }
      return next;
    });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaveError(null);
    const fields: Record<string, string> = {};
    for (const r of rows) {
      const k = r.key.trim();
      if (!k) continue;
      fields[k] = r.value;
    }
    if (!name.trim()) {
      setSaveError("Give the spec a name.");
      return;
    }
    if (Object.keys(fields).length === 0) {
      setSaveError("Add at least one field (e.g. Brand, Net Weight).");
      return;
    }
    setSaving(true);
    try {
      const created = await api.createSpec(name.trim(), fields);
      setName("");
      setRows([emptyRow()]);
      setShowForm(false);
      await load();
      setSelectedId(created.id);
    } catch (err) {
      setSaveError(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Product specifications
          </h1>
          <p className="mt-1 text-sm text-ink-600">
            Create and manage approved product specifications. Use these specs
            to verify printed labels.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm((v) => !v)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
        >
          <span aria-hidden="true" className="text-base leading-none">
            +
          </span>
          New spec
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <section className="card animate-rise p-5 sm:p-6">
          <h2 className="text-lg font-semibold text-navy-900">
            Create a specification
          </h2>
          <form onSubmit={submit} className="mt-4 space-y-4">
            <div>
              <label
                className="mb-1.5 block text-sm font-medium text-ink-900"
                htmlFor="spec-name"
              >
                Spec name
              </label>
              <input
                id="spec-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Golden Harvest Granola"
                className="w-full rounded-xl border border-mist-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-ink-500/60 focus:border-brand-600"
              />
            </div>
            <div>
              <span className="block text-sm font-medium text-ink-900">
                Fields
              </span>
              <div className="mt-2 flex flex-wrap gap-2">
                {FIELD_SUGGESTIONS.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => addSuggestion(s)}
                    className="rounded-full border border-mist-200 bg-mist-50 px-3 py-1.5 text-xs font-medium text-ink-600 transition-colors hover:border-brand-600 hover:text-brand-700"
                  >
                    + {s}
                  </button>
                ))}
              </div>
              <div className="mt-3 space-y-2">
                {rows.map((r, i) => (
                  <div key={i} className="flex gap-2">
                    <input
                      value={r.key}
                      onChange={(e) => updateRow(i, { key: e.target.value })}
                      placeholder="Field name"
                      aria-label={`Field ${i + 1} name`}
                      className="w-2/5 rounded-xl border border-mist-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-ink-500/60 focus:border-brand-600"
                    />
                    <input
                      value={r.value}
                      onChange={(e) => updateRow(i, { value: e.target.value })}
                      placeholder="Expected text"
                      aria-label={`Field ${i + 1} expected value`}
                      className="flex-1 rounded-xl border border-mist-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-ink-500/60 focus:border-brand-600"
                    />
                    <button
                      type="button"
                      onClick={() => removeRow(i)}
                      aria-label="Remove field row"
                      className="shrink-0 rounded-xl border border-mist-200 px-3 text-sm text-ink-500 transition-colors hover:border-[#f3b8b8] hover:text-[#c22727]"
                    >
                      ✕
                    </button>
                  </div>
                ))}
              </div>
            </div>
            {saveError && (
              <p className="rounded-xl border border-[#f3b8b8] bg-[#fdecec] px-4 py-2.5 text-sm text-[#c22727]">
                {saveError}
              </p>
            )}
            <div className="flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save spec"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="rounded-xl border border-mist-200 px-5 py-2.5 text-sm font-semibold text-ink-600 transition-colors hover:border-ink-500"
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Search */}
      <div className="relative max-w-md">
        <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="pointer-events-none absolute left-3.5 top-1/2 h-4.5 w-4.5 -translate-y-1/2 text-ink-500" aria-hidden="true">
          <circle cx="9" cy="9" r="5.5" />
          <path strokeLinecap="round" d="M13.5 13.5 17 17" />
        </svg>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search specifications…"
          aria-label="Search specifications"
          className="w-full rounded-xl border border-mist-200 bg-white py-2.5 pl-10 pr-4 text-sm outline-none transition-colors placeholder:text-ink-500/60 focus:border-brand-600"
        />
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
          {specs.length === 0 ? (
            <div className="card p-10 text-center">
              <p className="font-semibold text-navy-900">No specifications yet</p>
              <p className="mt-1 text-sm text-ink-600">
                Create your first spec to start verifying labels.
              </p>
              <button
                type="button"
                onClick={() => setShowForm(true)}
                className="mt-4 rounded-xl bg-brand-600 px-5 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-brand-700"
              >
                Create a specification
              </button>
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)]">
              {/* Left: spec list */}
              <ul className="space-y-3">
                {filtered.map((s) => {
                  const active = s.id === selectedId;
                  const fieldCount = Object.keys(s.fields).length;
                  return (
                    <li key={s.id}>
                      <button
                        type="button"
                        onClick={() => setSelectedId(s.id)}
                        aria-pressed={active}
                        className={`card flex w-full items-center gap-3 p-4 text-left transition-all hover:shadow-md ${
                          active
                            ? "ring-2 ring-brand-600"
                            : ""
                        }`}
                      >
                        <span
                          className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${avatarColor(s.name)}`}
                          aria-hidden="true"
                        >
                          {initials(s.name)}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="block truncate font-semibold text-navy-900">
                            {s.name}
                          </span>
                          <span className="mt-0.5 block text-xs text-ink-500">
                            {fieldCount} {fieldCount === 1 ? "field" : "fields"} · Created{" "}
                            {formatDate(s.created_at)}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })}
                {filtered.length === 0 && (
                  <li className="card p-6 text-center text-sm text-ink-500">
                    No specifications match “{query}”.
                  </li>
                )}
              </ul>

              {/* Right: selected spec detail */}
              <section className="card min-w-0 p-5 sm:p-6">
                {selected ? (
                  <>
                    <div className="flex items-center gap-4">
                      <span
                        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl text-lg font-bold ${avatarColor(selected.name)}`}
                        aria-hidden="true"
                      >
                        {initials(selected.name)}
                      </span>
                      <div className="min-w-0">
                        <h2 className="truncate text-xl font-bold text-navy-900">
                          {selected.name}
                        </h2>
                        <p className="text-xs text-ink-500">
                          Spec #{selected.id} · Created{" "}
                          {formatDate(selected.created_at)}
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 flex gap-2.5 rounded-xl border border-mist-200 bg-mist-50 p-4 text-sm text-ink-600">
                      <svg viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 shrink-0 text-brand-700" aria-hidden="true">
                        <circle cx="10" cy="10" r="7.5" />
                        <path strokeLinecap="round" d="M10 9.2v4" />
                        <circle cx="10" cy="6.8" r="1" fill="currentColor" stroke="none" />
                      </svg>
                      <p>
                        These fields are used to verify printed labels. Make
                        sure the information matches your approved source
                        (e.g., artwork, regulatory filing, or master data).
                      </p>
                    </div>

                    <div className="mt-5 overflow-x-auto rounded-xl border border-mist-200">
                      <table className="w-full min-w-[420px] text-left text-sm">
                        <thead>
                          <tr className="bg-mist-50 text-xs uppercase tracking-wide text-ink-500">
                            <th className="px-4 py-3 font-semibold">Field</th>
                            <th className="px-4 py-3 font-semibold">
                              Expected value
                            </th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.entries(selected.fields).map(([k, v]) => (
                            <tr
                              key={k}
                              className="border-t border-mist-100"
                            >
                              <td className="px-4 py-3 font-medium text-navy-900">
                                {k}
                              </td>
                              <td className="px-4 py-3 text-ink-600">{v}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <p className="p-6 text-center text-sm text-ink-500">
                    Select a specification to see its fields.
                  </p>
                )}
              </section>
            </div>
          )}
        </>
      )}
    </div>
  );
}
