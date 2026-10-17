import type { Inspection } from "@/lib/api";
import { FieldBadge, InspectionBadge } from "./StatusBadge";

/** Lines below this confidence are shown dimmed (contract: < 0.90 is uncertain). */
export const LOW_CONFIDENCE_THRESHOLD = 0.9;

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString();
}

export default function InspectionDetail({
  inspection,
}: {
  inspection: Inspection;
}) {
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-4">
        <InspectionBadge status={inspection.status} big />
        <div className="text-sm text-zinc-500 dark:text-zinc-400">
          <p>Inspection #{inspection.id}</p>
          <p>File: {inspection.image_filename}</p>
          <p>{formatDate(inspection.created_at)}</p>
        </div>
      </div>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Field results</h2>
        <div className="overflow-x-auto rounded-lg border border-zinc-200 dark:border-zinc-800">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-900">
              <tr>
                <th className="px-4 py-2 font-medium">Field</th>
                <th className="px-4 py-2 font-medium">Expected</th>
                <th className="px-4 py-2 font-medium">Found</th>
                <th className="px-4 py-2 font-medium">Status</th>
                <th className="px-4 py-2 font-medium">Confidence</th>
              </tr>
            </thead>
            <tbody>
              {inspection.results.map((r) => (
                <tr
                  key={r.field}
                  className="border-t border-zinc-200 dark:border-zinc-800"
                >
                  <td className="px-4 py-2 font-mono">{r.field}</td>
                  <td className="px-4 py-2">{r.expected}</td>
                  <td className="px-4 py-2">
                    {r.found ?? <span className="text-zinc-400">—</span>}
                  </td>
                  <td className="px-4 py-2">
                    <FieldBadge status={r.status} />
                  </td>
                  <td className="px-4 py-2 tabular-nums">
                    {(r.confidence * 100).toFixed(0)}%
                  </td>
                </tr>
              ))}
              {inspection.results.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="px-4 py-6 text-center text-zinc-500"
                  >
                    No field results.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">
          Extracted text{" "}
          <span className="text-sm font-normal text-zinc-500">
            (engine: {inspection.ocr.engine}, mean confidence{" "}
            {(inspection.ocr.mean_confidence * 100).toFixed(0)}% — lines below{" "}
            {(LOW_CONFIDENCE_THRESHOLD * 100).toFixed(0)}% are dimmed)
          </span>
        </h2>
        <ul className="space-y-1 rounded-lg border border-zinc-200 bg-zinc-50 p-4 font-mono text-sm dark:border-zinc-800 dark:bg-zinc-900">
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
                <span className="shrink-0 text-xs tabular-nums text-zinc-500">
                  {(line.confidence * 100).toFixed(0)}%
                </span>
              </li>
            );
          })}
          {inspection.ocr.lines.length === 0 && (
            <li className="text-zinc-500">No text extracted.</li>
          )}
        </ul>
      </section>
    </div>
  );
}
