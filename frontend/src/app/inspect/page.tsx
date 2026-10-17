"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import {
  api,
  friendlyErrorMessage,
  type Inspection,
  type OcrResult,
  type ProductSpec,
} from "@/lib/api";
import {
  formatBytes,
  MAX_LONGEST_SIDE_PX,
  MAX_UPLOAD_BYTES,
  prepareImage,
} from "@/lib/image";
import { MOCK_INSPECTION } from "@/lib/mock";
import InspectionDetail, {
  LOW_CONFIDENCE_THRESHOLD,
} from "@/components/InspectionDetail";

/**
 * Crop the uploaded image bytes to an OCR bounding box, with a little
 * padding for context. Used only for real inspections — never for the
 * clearly-labeled demo mock, whose bboxes are placeholders.
 */
async function cropToBbox(
  file: File,
  bbox: [number, number, number, number]
): Promise<string | null> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error("Could not decode image."));
      el.src = url;
    });
    const [l, t, w, h] = bbox;
    const sx = Math.max(0, Math.floor(l - w * 0.3));
    const sy = Math.max(0, Math.floor(t - h * 0.5));
    const ex = Math.min(img.width, Math.ceil(l + w + w * 0.3));
    const ey = Math.min(img.height, Math.ceil(t + h + h * 0.5));
    const sw = ex - sx;
    const sh = ey - sy;
    if (sw <= 0 || sh <= 0) return null;
    const canvas = document.createElement("canvas");
    canvas.width = sw;
    canvas.height = sh;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
    return canvas.toDataURL("image/jpeg", 0.9);
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function InspectContent() {
  const [specs, setSpecs] = useState<ProductSpec[]>([]);
  const [specId, setSpecId] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [compressNote, setCompressNote] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [inspection, setInspection] = useState<Inspection | null>(null);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [evidenceUrl, setEvidenceUrl] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchParams = useSearchParams();

  // OCR-only preview (POST /ocr works now; /inspections may still be a stub)
  const [ocrPreview, setOcrPreview] = useState<OcrResult | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);

  // Demo-only mock results, shown while POST /inspections is still a stub.
  // ?demo=1 (homepage "Try a Sample Inspection" CTA) opens them on load.
  const [mockShown, setMockShown] = useState(
    () => searchParams.get("demo") === "1"
  );

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

  // Build the evidence thumbnail for real inspections only.
  // (Reset happens in pickFile/submit; this effect only sets on success.)
  useEffect(() => {
    let cancelled = false;
    if (!inspection || !uploadedFile) return;
    (async () => {
      const flagged =
        inspection.results.find((r) => r.status === "incorrect") ??
        inspection.results.find((r) => r.status === "uncertain") ??
        null;
      if (!flagged?.found) return;
      const line = inspection.ocr.lines.find((li) => li.text === flagged.found);
      if (!line) return;
      const dataUrl = await cropToBbox(uploadedFile, line.bbox);
      if (!cancelled) setEvidenceUrl(dataUrl);
    })();
    return () => {
      cancelled = true;
    };
  }, [inspection, uploadedFile]);

  const pickFile = (f: File | undefined) => {
    if (!f) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(f);
    setPreviewUrl(URL.createObjectURL(f));
    setInspection(null);
    setUploadedFile(null);
    setEvidenceUrl(null);
    setOcrPreview(null);
    setCompressNote(null);
    setMockShown(false);
    setError(null);
  };

  const removeFile = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFile(null);
    setPreviewUrl(null);
    setCompressNote(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setInspection(null);
    setUploadedFile(null);
    setEvidenceUrl(null);
    setOcrPreview(null);
    setCompressNote(null);
    setMockShown(false);
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
      const result = await api.createInspection(
        Number(specId),
        prepared.file
      );
      setUploadedFile(prepared.file);
      setInspection(result);
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

  const selectedSpec = specs.find((s) => String(s.id) === specId) ?? null;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
          New inspection
        </h1>
        <p className="mt-1 text-sm text-ink-600">
          Select a product specification, upload a label photo, and get
          verification results.
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[380px_minmax(0,1fr)]">
        {/* Left: input steps */}
        <section className="card p-5 sm:p-6">
          <form onSubmit={submit} className="space-y-6">
            <div>
              <p className="text-sm font-semibold text-navy-900">
                1. Select product spec
              </p>
              <select
                value={specId}
                onChange={(e) => setSpecId(e.target.value)}
                aria-label="Product spec"
                className="mt-2 w-full rounded-xl border border-mist-200 bg-white px-3.5 py-2.5 text-sm outline-none transition-colors focus:border-brand-600"
              >
                {specs.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} (#{s.id})
                  </option>
                ))}
              </select>
              {specs.length === 0 ? (
                <p className="mt-1.5 text-xs text-ink-500">
                  No specs yet — create one on the{" "}
                  <a href="/specs" className="font-medium text-brand-700 underline">
                    Specs
                  </a>{" "}
                  page.
                </p>
              ) : (
                selectedSpec && (
                  <p className="mt-1.5 text-xs text-ink-500">
                    {Object.keys(selectedSpec.fields).length} fields ·{" "}
                    {selectedSpec.name}
                  </p>
                )
              )}
            </div>

            <div>
              <p className="text-sm font-semibold text-navy-900">
                2. Upload label photo
              </p>
              <div
                role="button"
                tabIndex={0}
                aria-label="Choose or drop a label photo"
                onClick={() => inputRef.current?.click()}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ")
                    inputRef.current?.click();
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
                className={`mt-2 flex cursor-pointer flex-col items-center justify-center rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors ${
                  dragging
                    ? "border-brand-600 bg-[#eef7f7]"
                    : "border-mist-200 bg-mist-50/60 hover:border-brand-500"
                }`}
              >
                {previewUrl ? (
                  <span className="relative block">
                    {/* eslint-disable-next-line @next/next/no-img-element -- blob: preview URL, next/image can't optimize it */}
                    <img
                      src={previewUrl}
                      alt="Label preview"
                      className="max-h-52 rounded-xl border border-mist-200 object-contain"
                    />
                    <button
                      type="button"
                      aria-label="Remove photo"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeFile();
                      }}
                      className="absolute -right-2.5 -top-2.5 flex h-7 w-7 items-center justify-center rounded-full bg-navy-900 text-sm text-white shadow transition-colors hover:bg-[#c22727]"
                    >
                      ✕
                    </button>
                  </span>
                ) : (
                  <>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-9 w-9 text-brand-600" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 16V6m0 0-4 4m4-4 4 4" />
                      <path strokeLinecap="round" d="M4 17v1.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V17" />
                    </svg>
                    <p className="mt-3 text-sm font-semibold text-navy-900">
                      Drag &amp; drop a label photo here
                      <br />
                      <span className="font-normal text-ink-500">
                        or click to choose
                      </span>
                    </p>
                    <p className="mt-1.5 text-xs text-ink-500">
                      PNG, JPEG, WEBP, BMP or TIFF
                      <br />
                      (Max 4 MB, auto-resized to 1600px)
                    </p>
                  </>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/bmp,image/tiff"
                  className="hidden"
                  aria-label="Label photo file"
                  onChange={(e) => pickFile(e.target.files?.[0])}
                />
              </div>
              {file && (
                <p className="mt-2 text-xs text-ink-500">
                  {file.name} · {formatBytes(file.size)}
                  {compressNote ? ` · ${compressNote}` : ""}
                </p>
              )}
              <p className="mt-1.5 text-xs leading-relaxed text-ink-500">
                Photos are automatically resized and compressed below{" "}
                {formatBytes(MAX_UPLOAD_BYTES)} (max {MAX_LONGEST_SIDE_PX}px on
                the longest side) before upload.
              </p>
            </div>

            {error && (
              <div className="rounded-xl border border-[#f5d9a8] bg-[#fffaf0] px-4 py-3 text-sm text-[#9a4a0a]">
                {error}
                {error.includes("not implemented") && file && (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
                    <button
                      type="button"
                      onClick={() => void previewOcr()}
                      disabled={ocrLoading}
                      className="font-semibold underline disabled:opacity-50"
                    >
                      {ocrLoading
                        ? "Reading text…"
                        : "Preview OCR text only (works now)"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setMockShown(true)}
                      className="font-semibold underline"
                    >
                      View sample results (demo)
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting}
              className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-brand-600 px-5 py-3 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {submitting ? (
                "Verifying…"
              ) : (
                <>
                  Verify Label <span aria-hidden="true">→</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* Right: results */}
        <div className="min-w-0 space-y-6">
          {mockShown && (
            <div>
              <div className="mb-4 rounded-xl border-2 border-dashed border-brand-600/50 bg-[#eef7f7] px-4 py-3 text-sm text-ink-600">
                <span className="font-bold text-brand-700">
                  Sample results — demo only.
                </span>{" "}
                The inspection API isn&apos;t ready yet, so this is placeholder
                data to show the layout.
              </div>
              <InspectionDetail inspection={MOCK_INSPECTION} />
            </div>
          )}

          {!mockShown && inspection && (
            <InspectionDetail
              inspection={inspection}
              evidenceUrl={evidenceUrl}
            />
          )}

          {!mockShown && !inspection && ocrPreview && (
            <section className="card p-5 sm:p-6">
              <h2 className="text-base font-semibold text-navy-900">
                OCR preview
              </h2>
              <ul className="mt-3 space-y-1 rounded-xl bg-mist-50 p-4 font-mono text-sm">
                {ocrPreview.lines.map((line, i) => (
                  <li
                    key={i}
                    className={`flex items-baseline justify-between gap-4 ${
                      line.confidence < LOW_CONFIDENCE_THRESHOLD
                        ? "opacity-40"
                        : ""
                    }`}
                  >
                    <span>{line.text}</span>
                    <span className="shrink-0 text-xs tabular-nums text-ink-500">
                      {(line.confidence * 100).toFixed(0)}%
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {!mockShown && !inspection && !ocrPreview && (
            <div className="card flex min-h-[320px] flex-col items-center justify-center p-10 text-center">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" className="h-12 w-12 text-mist-200" aria-hidden="true">
                <circle cx="10.5" cy="10.5" r="6.5" />
                <path strokeLinecap="round" d="M15.5 15.5 21 21" />
              </svg>
              <p className="mt-4 font-semibold text-navy-900">
                Your verification results will appear here
              </p>
              <p className="mt-1 max-w-xs text-sm text-ink-500">
                Pick a spec, upload a label photo, and press Verify Label — or
                preview clearly-labeled sample results while the API is being
                built.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function InspectPage() {
  return (
    <Suspense
      fallback={
        <p className="text-sm text-ink-500">Loading inspection page…</p>
      }
    >
      <InspectContent />
    </Suspense>
  );
}
