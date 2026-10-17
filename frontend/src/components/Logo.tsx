import { useId } from "react";

export default function Logo({
  variant = "dark",
}: {
  variant?: "dark" | "light";
}) {
  const gradientId = useId();
  return (
    <span className="inline-flex items-center gap-2" data-logo="verilabel">
      <svg
        viewBox="0 0 32 32"
        width="28"
        height="28"
        className="shrink-0"
        aria-hidden="true"
        role="presentation"
      >
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop stopColor="#22D3EE" />
            <stop offset="1" stopColor="#0E7490" />
          </linearGradient>
        </defs>
        <path
          d="M16 2.5 27 6.5v7.8c0 6.8-4.4 11.6-11 15.2C9.4 25.9 5 20.1 5 14.3V6.5L16 2.5Z"
          fill={`url(#${gradientId})`}
        />
        <path
          d="M11 15.8l3.6 3.6L21.4 12"
          stroke="#ffffff"
          strokeWidth="3"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span
        className={`text-lg font-bold tracking-tight ${
          variant === "light" ? "text-white" : "text-navy-900"
        }`}
      >
        VeriLabel
      </span>
    </span>
  );
}
