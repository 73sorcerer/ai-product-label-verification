"use client";

import { useEffect, useRef, useState } from "react";
import {
  api,
  friendlyErrorMessage,
  type Inspection,
  type OcrResult,
  type ProductSpec,
} from "@/lib/api";
import {
  formatBytes,
  prepareImage,
} from "@/lib/image";
import InspectionDetail, {
  LOW_CONFIDENCE_THRESHOLD,
} from "@/components/InspectionDetail";

export default function InspectPage() {
  const [specs, setSpecs] = useState<ProductSpec[]>([]);
  const [specId, setSpecId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [compressNote, setCompressNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

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
        if (list.length > 0) setSpecId((cur) => cur || String(list[0].id));
      } catch (err) {
        if (!cancelled) setError(friendlyErrorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setInspection(null);
    setOcrPreview(null);
    setCompressNote(null);
    setError(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInspection(null);
    setOcrPreview(null);
    setCompressNote(null);
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
      const prepared = await prepareImage(file);
      if (prepared.compressed) {
        setCompressNote(
          `Compressed ${formatBytes(prepared.originalBytes)} → ${formatBytes(
            prepared.finalBytes
          )} for upload.`
        );
      }
      setInspection(await api.createInspection(Number(specId), prepared.file));
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
      const prepared = await prepareImage(file);
      setOcrPreview(await api.ocr(prepared.file));
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
          <label className="mb-1 block text-sm font-medium">Label image</label>
          <div
            role="button"
            tabIndex={0}
            aria-label="Choose or drop a label photo"
            onClick={() => inputRef.current?.click()}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") inputRef.current?.click();
            }}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              pickFile(e.dataTransfer.files?.[0]);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-10 text-center transition-colors ${
              dragging
                ? "border-zinc-950 bg-zinc-100 dark:border-zinc-50 dark:bg-zinc-900"
                : "border-zinc-300 hover:border-zinc-400 dark:border-zinc-700 dark:hover:border-zinc-600"
            }`}
          >
            {previewUrl ? (
              // eslint-disable-next-line @next/next/no-img-element -- blob: preview URL, next/image can't optimize it
              <img
                src={previewUrl}
                alt="Label preview"
                className="max-h-56 rounded-md object-contain"
              />
            ) : (
              <>
                <p className="text-sm font-medium">
                  Drag &amp; drop a label photo here, or click to choose
                </p>
                <p className="mt-1 text-xs text-zinc-500">
                  PNG, JPEG, WEBP, BMP or TIFF
                </p>
              </>
            )}
            <input
              ref={inputRef}
              id="image"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/bmp,image/tiff"
              className="hidden"
              onChange={(e) => pickFile(e.target.files?.[0])}
            />
          </div>
          {file && (
            <p className="mt-2 text-xs text-zinc-500">
              {file.name} · {formatBytes(file.size)}
              {compressNote ? ` · ${compressNote}` : ""}
            </p>
          )}
          <p className="mt-1 text-xs text-zinc-500">
            Photos are automatically compressed below 4 MB before upload.
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
