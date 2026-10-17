import type { Inspection } from "@/lib/api";
import { FieldBadge, InspectionBadge } from "./StatusBadge";

/** Lines below this confidence are shown dimmed (contract: < 0.90 is uncertain). */
export const LOW_CONFIDENCE_THRESHOLD = 0.9;

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

/** "net_contents" -> "Net Contents" */
export function prettyField(key: string): string {
  return key
    .split("_")
    .map((w) => (w ? w[0].toUpperCase() + w.slice(1) : w))
    .join(" ");
}

export default function InspectionDetail({
  inspection,
  evidenceUrl,
}: {
  inspection: Inspection;
  /** Cropped thumbnail of the flagged label region, from the uploaded bytes. */
  evidenceUrl?: string | null;
}) {
  const results = inspection.results;
  const counts = {
    checked: results.length,
    mismatch: results.filter((r) => r.status === "incorrect").length,
    uncertain: results.filter((r) => r.status === "uncertain").length,
    missing: results.filter((r) => r.status === "missing").length,
  };
  const flagged =
    results.find((r) => r.status === "incorrect") ??
    results.find((r) => r.status === "uncertain") ??
    null;

  const bannerStyles =
    inspection.status === "pass"
      ? "border-[#bbe5c9] bg-[#eef9f1]"
      : "border-[#f5d9a8] bg-[#fdf6e8]";

  const stats = [
    { label: "Fields checked", value: counts.checked, classes: "text-navy-900" },
    { label: "Mismatch", value: counts.mismatch, classes: "text-[#c22727]" },
    { label: "Uncertain", value: counts.uncertain, classes: "text-[#b45309]" },
    { label: "Missing", value: counts.missing, classes: "text-ink-500" },
  ];

  return (
    <div className="space-y-6">
      {/* Result banner */}
      <div className={`card flex flex-wrap items-center justify-between gap-4 !border-2 p-5 ${bannerStyles}`}>
        <div className="flex items-center gap-4">
          <InspectionBadge status={inspection.status} big />
          <div className="text-sm text-ink-500">
            <p className="font-medium text-ink-900">
              Inspection #{inspection.id}
            </p>
            <p className="truncate">{inspection.image_filename}</p>
          </div>
        </div>
        <p className="text-sm text-ink-500">{formatDate(inspection.created_at)}</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="card p-4 text-center">
            <p className={`text-3xl font-bold tabular-nums ${s.classes}`}>
              {s.value}
            </p>
            <p className="mt-1 text-xs font-medium uppercase tracking-wide text-ink-500">
              {s.label}
            </p>
          </div>
        ))}
      </div>

      {/* Field comparison */}
      <section className="card overflow-hidden">
        <h2 className="border-b border-mist-200 px-5 py-4 text-base font-semibold">
          Field comparison
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead>
              <tr className="text-xs uppercase tracking-wide text-ink-500">
                <th className="px-5 py-3 font-semibold">Field</th>
                <th className="px-5 py-3 font-semibold">Expected value</th>
                <th className="px-5 py-3 font-semibold">Detected value</th>
                <th className="px-5 py-3 font-semibold">Status</th>
                <th className="px-5 py-3 font-semibold">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {results.map((r) => (
                <tr
                  key={r.field}
                  className={`border-t border-mist-100 ${
                    r.status === "incorrect"
                      ? "bg-[#fdf1f1]"
                      : r.status === "uncertain"
                        ? "bg-[#fdf8ec]"
                        : ""
                  }`}
                >
                  <td className="px-5 py-3 font-medium">
                    {prettyField(r.field)}
                  </td>
                  <td className="px-5 py-3 text-ink-600">{r.expected}</td>
                  <td
                    className={`px-5 py-3 ${
                      r.status === "incorrect"
                        ? "font-semibold text-[#c22727]"
                        : r.found
                          ? "text-ink-900"
                          : "text-ink-500"
                    }`}
                  >
                    {r.found ?? "—"}
                  </td>
                  <td className="px-5 py-3">
                    <FieldBadge status={r.status} />
                  </td>
                  <td className="px-5 py-3 tabular-nums text-ink-600">
                    {r.confidence.toFixed(2)}
                  </td>
                </tr>
              ))}
              {results.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-5 py-8 text-center text-ink-500"
                  >
                    No field results.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* Mismatch callout */}
      {flagged && (
        <div className="card flex flex-col gap-4 border-[#f5d9a8] bg-[#fffaf0] p-5 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 font-semibold text-[#9a4a0a]">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-5 w-5 shrink-0" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 2 14.5 13.5h-13L8 2Z" />
                <path strokeLinecap="round" d="M8 6.5v3.2" />
                <circle cx="8" cy="11.6" r="0.9" fill="currentColor" stroke="none" />
              </svg>
              {flagged.status === "incorrect"
                ? `${prettyField(flagged.field)} does not match`
                : `${prettyField(flagged.field)} needs a closer look`}
            </p>
            <p className="mt-1.5 text-sm text-ink-600">
              Expected “{flagged.expected}”
              {flagged.found ? (
                <>
                  {" "}
                  but detected “<span className="font-semibold text-[#c22727]">{flagged.found}</span>”.
                </>
              ) : (
                " but nothing readable was detected."
              )}{" "}
              Check the label before proceeding.
            </p>
          </div>
          {evidenceUrl && (
            // eslint-disable-next-line @next/next/no-img-element -- data: URL crop of the uploaded photo; next/image can't optimize it
            <img
              src={evidenceUrl}
              alt={`Close-up of the ${prettyField(flagged.field)} region on the uploaded label`}
              className="h-28 w-28 shrink-0 rounded-xl border border-mist-200 object-cover"
            />
          )}
        </div>
      )}

      {/* Extracted text */}
      <section className="card p-5">
        <h2 className="text-base font-semibold">
          Extracted text{" "}
          <span className="text-sm font-normal text-ink-500">
            (engine: {inspection.ocr.engine}, mean confidence{" "}
            {(inspection.ocr.mean_confidence * 100).toFixed(0)}% — lines below{" "}
            {(LOW_CONFIDENCE_THRESHOLD * 100).toFixed(0)}% are dimmed)
          </span>
        </h2>
        <ul className="mt-3 space-y-1 rounded-xl bg-mist-50 p-4 font-mono text-sm">
          {inspection.ocr.lines.map((line, i) => {
            const dim = line.confidence < LOW_CONFIDENCE_THRESHOLD;
            return (
              <li
                key={i}
                className={`flex items-baseline justify-between gap-4 ${
                  dim ? "opacity-40" : ""
                }`}
                title={`confidence ${(line.confidence * 100).toFixed(1)}%`}
              >
                <span>{line.text}</span>
                <span className="shrink-0 text-xs tabular-nums text-ink-500">
                  {(line.confidence * 100).toFixed(0)}%
                </span>
              </li>
            );
          })}
          {inspection.ocr.lines.length === 0 && (
            <li className="text-ink-500">No text extracted.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
