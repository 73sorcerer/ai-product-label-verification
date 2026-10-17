import type { FieldStatus, InspectionStatus } from "@/lib/api";

function CheckIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.5 6.5 12 13 4.5" />
    </svg>
  );
}

function AlertIcon({ className = "h-4 w-4" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.8" className={className} aria-hidden="true">
      <path strokeLinecap="round" strokeLinejoin="round" d="M8 2 14.5 13.5h-13L8 2Z" />
      <path strokeLinecap="round" d="M8 6.5v3.2" />
      <circle cx="8" cy="11.6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

const inspectionStyles: Record<InspectionStatus | "error", string> = {
  error: "border-[#f3b8b8] bg-[#fdecec] text-[#c22727]",
  pass: "border-[#bbe5c9] bg-[#e7f6ec] text-[#15803d]",
  needs_review: "border-[#f5d9a8] bg-[#fdf0dc] text-[#b45309]",
};

const inspectionLabels: Record<InspectionStatus | "error", string> = {
  error: "Error",
  pass: "Pass",
  needs_review: "Needs Review",
};

export function InspectionBadge({
  status,
  big = false,
}: {
  status: InspectionStatus | "error";
  big?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border font-semibold ${inspectionStyles[status]} ${
        big ? "px-5 py-2 text-xl" : "px-3 py-1 text-sm"
      }`}
    >
      {status === "pass" ? <CheckIcon /> : <AlertIcon />}
      {inspectionLabels[status]}
    </span>
  );
}

const fieldConfig: Record<
  FieldStatus,
  { label: string; classes: string; icon: "check" | "alert" | "x" }
> = {
  match: {
    label: "Match",
    classes: "border-[#bbe5c9] bg-[#e7f6ec] text-[#15803d]",
    icon: "check",
  },
  incorrect: {
    label: "Mismatch",
    classes: "border-[#f3b8b8] bg-[#fdecec] text-[#c22727]",
    icon: "x",
  },
  missing: {
    label: "Missing",
    classes: "border-[#f3b8b8] bg-[#fdecec] text-[#c22727]",
    icon: "x",
  },
  uncertain: {
    label: "Uncertain",
    classes: "border-[#f5d9a8] bg-[#fdf0dc] text-[#b45309]",
    icon: "alert",
  },
};

function XIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.2" className="h-3.5 w-3.5" aria-hidden="true">
      <path strokeLinecap="round" d="M4 4l8 8M12 4l-8 8" />
    </svg>
  );
}

export function FieldBadge({ status }: { status: FieldStatus }) {
  const cfg = fieldConfig[status];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${cfg.classes}`}
    >
      {cfg.icon === "check" ? (
        <CheckIcon className="h-3.5 w-3.5" />
      ) : cfg.icon === "alert" ? (
        <AlertIcon className="h-3.5 w-3.5" />
      ) : (
        <XIcon />
      )}
      {cfg.label}
    </span>
  );
}
