"use client";

import { useCallback, useEffect, useState } from "react";
import { api, friendlyErrorMessage, type ProductSpec } from "@/lib/api";

type FieldRow = { key: string; value: string };

function emptyRow(): FieldRow {
  return { key: "", value: "" };
}

export default function SpecsPage() {
  const [specs, setSpecs] = useState<ProductSpec[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [rows, setRows] = useState<FieldRow[]>([emptyRow()]);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSpecs(await api.listSpecs());
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
        if (!cancelled) setSpecs(data);
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

  const updateRow = (i: number, patch: Partial<FieldRow>) =>
    setRows((rs) => rs.map((r, j) => (j === i ? { ...r, ...patch } : r)));

  const removeRow = (i: number) =>
    setRows((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs));

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
      setSaveError("Add at least one field (e.g. brand, net_contents).");
      return;
    }
    setSaving(true);
    try {
      await api.createSpec(name.trim(), fields);
      setName("");
      setRows([emptyRow()]);
      await load();
    } catch (err) {
      setSaveError(friendlyErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-10">
      <section>
        <h1 className="text-2xl font-bold">Product specs</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Save an approved label spec. Inspections compare label photos
          against these fields.
        </p>
      </section>

      <section className="rounded-lg border border-zinc-200 p-5 dark:border-zinc-800">
        <h2 className="mb-4 text-lg font-semibold">Create a spec</h2>
        <form onSubmit={submit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm font-medium" htmlFor="name">
              Spec name
            </label>
            <input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Golden Harvest Granola"
              className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
            />
          </div>
          <div className="space-y-2">
            <span className="block text-sm font-medium">Fields</span>
            {rows.map((r, i) => (
              <div key={i} className="flex gap-2">
                <input
                  value={r.key}
                  onChange={(e) => updateRow(i, { key: e.target.value })}
                  placeholder="field key (e.g. brand)"
                  className="w-1/3 rounded-md border border-zinc-300 bg-transparent px-3 py-2 font-mono text-sm dark:border-zinc-700"
                />
                <input
                  value={r.value}
                  onChange={(e) => updateRow(i, { value: e.target.value })}
                  placeholder="expected text"
                  className="flex-1 rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
                />
                <button
                  type="button"
                  onClick={() => removeRow(i)}
                  className="rounded-md border border-zinc-300 px-3 text-sm text-zinc-500 hover:bg-zinc-100 dark:border-zinc-700 dark:hover:bg-zinc-900"
                  aria-label="Remove field row"
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={() => setRows((rs) => [...rs, emptyRow()])}
              className="text-sm text-zinc-600 underline-offset-4 hover:underline dark:text-zinc-400"
            >
              + Add field
            </button>
          </div>
          {saveError && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-900/20 dark:text-red-300">
              {saveError}
            </p>
          )}
          <button
            type="submit"
            disabled={saving}
            className="rounded-md bg-zinc-950 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            {saving ? "Saving…" : "Save spec"}
          </button>
        </form>
      </section>

      <section>
        <h2 className="mb-4 text-lg font-semibold">Existing specs</h2>
        {loading && <p className="text-sm text-zinc-500">Loading…</p>}
        {error && (
          <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            {error}{" "}
            <button onClick={() => void load()} className="underline">
              Retry
            </button>
          </div>
        )}
        {!loading && !error && specs.length === 0 && (
          <p className="text-sm text-zinc-500">No specs yet — create one above.</p>
        )}
        <ul className="space-y-3">
          {specs.map((s) => (
            <li
              key={s.id}
              className="rounded-lg border border-zinc-200 p-4 dark:border-zinc-800"
            >
              <div className="flex items-baseline justify-between">
                <span className="font-medium">{s.name}</span>
                <span className="font-mono text-xs text-zinc-500">
                  #{s.id}
                </span>
              </div>
              <dl className="mt-2 space-y-1 text-sm">
                {Object.entries(s.fields).map(([k, v]) => (
                  <div key={k} className="flex gap-2">
                    <dt className="w-32 shrink-0 font-mono text-zinc-500">{k}</dt>
                    <dd>{v}</dd>
                  </div>
                ))}
              </dl>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
