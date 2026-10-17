import Link from "next/link";

const checks = [
  "Compare against approved specs",
  "Find mismatches and missing info",
  "Keep inspection records",
];

const features = [
  {
    title: "Reference",
    text: "Compare against your saved product specifications.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 3.5h11L20 7.5v13H5v-17Z" />
        <path strokeLinecap="round" d="M16 3.5V7.5h4M8.5 12h7M8.5 15.5h7" />
      </svg>
    ),
  },
  {
    title: "Detection",
    text: "Extract readable text from uploaded label images.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V5.5A1.5 1.5 0 0 1 5.5 4H8M16 4h2.5A1.5 1.5 0 0 1 20 5.5V8M20 16v2.5a1.5 1.5 0 0 1-1.5 1.5H16M8 20H5.5A1.5 1.5 0 0 1 4 18.5V16" />
        <circle cx="12" cy="12" r="3.2" />
      </svg>
    ),
  },
  {
    title: "Review",
    text: "Flag differences and uncertain text for attention.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4 20.5 19.5h-17L12 4Z" />
        <path strokeLinecap="round" d="M12 10v4" />
        <circle cx="12" cy="16.8" r="1" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    title: "Traceability",
    text: "Revisit saved inspection results when available.",
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-6 w-6" aria-hidden="true">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12a7.5 7.5 0 1 1 2.2 5.3M4.5 12V8.2M4.5 12h3.8" />
        <path strokeLinecap="round" d="M12 7.5V12l3 1.8" />
      </svg>
    ),
  },
];

const cardFields = [
  "Product Name",
  "Net Weight",
  "Ingredients",
  "Allergens",
  "Barcode",
];

function JarIllustration() {
  return (
    <svg
      viewBox="0 0 220 300"
      className="animate-float-soft h-64 w-auto drop-shadow-[0_24px_32px_rgba(14,124,130,0.25)] sm:h-80"
      role="img"
      aria-label="Illustration of a hot sauce jar"
    >
      {/* cap */}
      <rect x="82" y="8" width="56" height="36" rx="9" fill="#232a35" />
      <rect x="82" y="38" width="56" height="7" fill="#141a24" />
      {/* neck */}
      <rect x="90" y="45" width="40" height="20" fill="#a83a26" />
      {/* body */}
      <rect x="58" y="64" width="104" height="222" rx="30" fill="#c0452f" />
      {/* glass highlight */}
      <rect x="70" y="82" width="13" height="180" rx="6.5" fill="#ffffff" opacity="0.16" />
      {/* label */}
      <rect x="58" y="118" width="104" height="118" fill="#f7f1e2" />
      <rect x="58" y="118" width="104" height="10" fill="#0e7c82" />
      <rect x="58" y="226" width="104" height="10" fill="#0e7c82" />
      <text x="110" y="150" textAnchor="middle" fontSize="17" fontWeight="800" fill="#232a35" fontFamily="inherit" letterSpacing="1">
        ORIGINAL
      </text>
      <text x="110" y="176" textAnchor="middle" fontSize="21" fontWeight="800" fill="#c0452f" fontFamily="inherit" letterSpacing="0.5">
        HOT SAUCE
      </text>
      <text x="110" y="196" textAnchor="middle" fontSize="10" fill="#5d738d" fontFamily="inherit">
        All Natural Ingredients
      </text>
      <text x="110" y="212" textAnchor="middle" fontSize="9" fill="#5d738d" fontFamily="inherit">
        NET WT. 12 OZ (340 g)
      </text>
    </svg>
  );
}

function VerificationCard() {
  return (
    <div className="card animate-rise w-60 p-5">
      <div className="flex items-center gap-2.5">
        <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[#e7f6ec]">
          <svg viewBox="0 0 16 16" fill="none" stroke="#15803d" strokeWidth="2.4" className="h-5 w-5" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.5 6.5 12 13 4.5" />
          </svg>
        </span>
        <div>
          <p className="font-bold text-[#15803d]">Pass</p>
          <p className="text-xs text-ink-500">5 of 5 fields match</p>
        </div>
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {cardFields.map((f) => (
          <li key={f} className="flex items-center justify-between text-ink-600">
            <span>{f}</span>
            <svg viewBox="0 0 16 16" fill="none" stroke="#15803d" strokeWidth="2.4" className="h-4 w-4" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.5 6.5 12 13 4.5" />
            </svg>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function Home() {
  return (
    <div>
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-4 pb-16 pt-12 sm:px-6 sm:pt-20 lg:grid-cols-2">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand-600">
            AI product label verification
          </p>
          <h1 className="mt-4 text-4xl font-extrabold leading-tight tracking-tight text-navy-900 sm:text-5xl">
            Catch label mistakes{" "}
            <span className="text-brand-600">
              before your next production run.
            </span>
          </h1>
          <p className="mt-5 max-w-lg text-lg leading-relaxed text-ink-600">
            One wrong label can mean wasted packaging, costly reprints, and
            delayed shipments. VeriLabel compares photographed product labels
            with your approved specifications, highlighting differences and
            unreadable fields so your team knows what needs attention.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/inspect?demo=1"
              className="inline-flex items-center gap-1.5 rounded-xl bg-brand-600 px-6 py-3.5 font-semibold text-white shadow-sm transition-colors hover:bg-brand-700"
            >
              Try a Sample Inspection
              <span aria-hidden="true">→</span>
            </Link>
            <Link
              href="/specs"
              className="inline-flex items-center rounded-xl border border-mist-200 bg-white px-6 py-3.5 font-semibold text-navy-900 transition-colors hover:border-brand-600 hover:text-brand-700"
            >
              Create a Specification
            </Link>
          </div>
          <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-ink-600">
            {checks.map((c) => (
              <li key={c} className="flex items-center gap-1.5">
                <svg viewBox="0 0 16 16" fill="none" stroke="#0e7c82" strokeWidth="2.4" className="h-4 w-4 shrink-0" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 8.5 6.5 12 13 4.5" />
                </svg>
                {c}
              </li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto flex w-full max-w-md items-center justify-center py-6">
          <div
            className="absolute h-72 w-72 rounded-full bg-mist-100 blur-2xl sm:h-96 sm:w-96"
            aria-hidden="true"
          />
          <JarIllustration />
          <div className="absolute -right-2 top-2 sm:right-2">
            <VerificationCard />
          </div>
          <p className="absolute -bottom-2 right-0 text-xs italic text-ink-500">
            Illustrative example — not a real inspection result
          </p>
        </div>
      </section>

      {/* Features */}
      <section className="border-t border-mist-200 bg-mist-50/60">
        <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
          <h2 className="text-center text-2xl font-bold tracking-tight text-navy-900 sm:text-3xl">
            Built for the checks your team already makes
          </h2>
          <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {features.map((f) => (
              <div key={f.title} className="card p-6">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-mist-100 text-brand-700">
                  {f.icon}
                </span>
                <h3 className="mt-4 font-semibold text-navy-900">{f.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-ink-600">
                  {f.text}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
