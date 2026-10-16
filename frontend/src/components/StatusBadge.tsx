import type { FieldStatus, InspectionStatus } from "@/lib/api";

const inspectionStyles: Record<InspectionStatus, string> = {
  pass: "bg-green-100 text-green-900 border-green-300 dark:bg-green-900/30 dark:text-green-200 dark:border-green-700",
  needs_review:
    "bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-900/30 dark:text-amber-200 dark:border-amber-700",
};

const inspectionLabels: Record<InspectionStatus, string> = {
  pass: "Pass",
  needs_review: "Needs Review",
};

const fieldStyles: Record<FieldStatus, string> = {
  match: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
  missing: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
  incorrect:
    "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
  uncertain:
    "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
};

export function InspectionBadge({
  status,
  big = false,
}: {
  status: InspectionStatus;
  big?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-full border font-semibold ${inspectionStyles[status]} ${
        big ? "px-6 py-2 text-2xl" : "px-3 py-0.5 text-sm"
      }`}
    >
      {inspectionLabels[status]}
    </span>
  );
}

export function FieldBadge({ status }: { status: FieldStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${fieldStyles[status]}`}
    >
      {status.replace("_", " ")}
    </span>
  );
}
