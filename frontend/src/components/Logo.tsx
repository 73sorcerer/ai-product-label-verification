export default function Logo({
  variant = "dark",
}: {
  variant?: "dark" | "light";
}) {
  return (
    <span className="inline-flex items-center gap-2">
      <svg
        viewBox="0 0 32 32"
        className="h-8 w-8"
        aria-hidden="true"
        role="presentation"
      >
        <path
          d="M16 2.5 27 6.5v7.8c0 6.8-4.4 11.6-11 15.2C9.4 25.9 5 20.1 5 14.3V6.5L16 2.5Z"
          fill="#0e7c82"
        />
        <path
          d="M11 15.8l3.6 3.6L21.4 12"
          stroke="#ffffff"
          strokeWidth="2.6"
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
