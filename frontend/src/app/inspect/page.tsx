"use client";

import { useEffect, useState } from "react";
import {
  api,
  friendlyErrorMessage,
  type Inspection,
  type OcrResult,
  type ProductSpec,
} from "@/lib/api";
import InspectionDetail, {
  LOW_CONFIDENCE_THRESHOLD,
} from "@/components/InspectionDetail";

export default function InspectPage() {
  const [specs, setSpecs] = useState<ProductSpec[]>([]);
  const [specId, setSpecId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);

  // OCR-only preview (POST /ocr works now; /inspections may still be a stub)
  const [ocrPreview, setOcrPreview] = useState<OcrResult | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const list = await api.listSpecs();
        if (cancelled) return;
        setSpecs(list);
        if (list.length > 0)
          setSpecId((cur) => cur || String(list[0].id));
      } catch (err) {
        if (!cancelled) setError(friendlyErrorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInspection(null);
    setOcrPreview(null);
    if (!specId) {
      setError("Pick a spec first.");
      return;
    }
    if (!file) {
      setError("Choose a label image to upload.");
      return;
    }
    setSubmitting(true);
    try {
      setInspection(await api.createInspection(Number(specId), file));
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const previewOcr = async () => {
    if (!file) return;
    setOcrLoading(true);
    setOcrPreview(null);
    try {
      setOcrPreview(await api.ocr(file));
    } catch (err) {
      setError(friendlyErrorMessage(err));
    } finally {
      setOcrLoading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">New inspection</h1>
        <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
          Pick a spec, upload a label photo, and get Pass or Needs Review.
        </p>
      </div>

      <form
        onSubmit={submit}
        className="space-y-4 rounded-lg border border-zinc-200 p-5 dark:border-zinc-800"
      >
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="spec">
            Spec
          </label>
          <select
            id="spec"
            value={specId}
            onChange={(e) => setSpecId(e.target.value)}
            className="w-full rounded-md border border-zinc-300 bg-transparent px-3 py-2 text-sm dark:border-zinc-700"
          >
            {specs.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name} (#{s.id})
              </option>
            ))}
          </select>
          {specs.length === 0 && (
            <p className="mt-1 text-xs text-zinc-500">
              No specs yet — create one on the{" "}
              <a href="/specs" className="underline">
                Specs
              </a>{" "}
              page.
            </p>
          )}
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium" htmlFor="image">
            Label image
          </label>
          <input
            id="image"
            type="file"
            accept="image/png,image/jpeg,image/webp,image/bmp,image/tiff"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="w-full text-sm"
          />
          <p className="mt-1 text-xs text-zinc-500">
            PNG, JPEG, WEBP, BMP or TIFF. Photos over 4 MB are shrunk automatically before upload.
          </p>
        </div>
        {error && (
          <div className="rounded-md bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:bg-amber-900/20 dark:text-amber-300">
            {error}
            {error.includes("not implemented") && file && (
              <div className="mt-2">
                <button
                  type="button"
                  onClick={() => void previewOcr()}
                  disabled={ocrLoading}
                  className="underline disabled:opacity-50"
                >
                  {ocrLoading
                    ? "Reading text…"
                    : "Preview OCR text only (works now)"}
                </button>
              </div>
            )}
          </div>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-md bg-zinc-950 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50 dark:bg-zinc-50 dark:text-zinc-950 dark:hover:bg-zinc-200"
        >
          {submitting ? "Verifying…" : "Run inspection"}
        </button>
      </form>

      {ocrPreview && (
        <section>
          <h2 className="mb-3 text-lg font-semibold">OCR preview</h2>
          <ul className="space-y-1 rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-900">
            {ocrPreview.lines.map((line, i) => (
              <li
                key={i}
                className={`flex items-baseline justify-between gap-4 ${
                  line.confidence < LOW_CONFIDENCE_THRESHOLD ? "opacity-40" : ""
                }`}
              >
                <span>{line.text}</span>
                <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                  {(line.confidence * 100).toFixed(0)}%
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {inspection && (
        <section>
          <h2 className="mb-4 text-lg font-semibold">Result</h2>
          <InspectionDetail inspection={inspection} />
        </section>
      )}
    </div>
  );
}
