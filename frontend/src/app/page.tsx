/* eslint-disable @next/next/no-img-element -- local product photography */
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
  return <img src="/products/hero-hot-sauce.png" alt="Original Hot Sauce bottle with a printed cream label" className="hero-bottle" />;
}

function VerificationCard() {
  return (
    <div className="verification-card">
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
  return <div className="landing-page">
    <section id="product" className="landing-hero">
      <div className="hero-copy">
        <p className="hero-eyebrow">AI PRODUCT LABEL VERIFICATION</p>
        <h1>Catch label mistakes <span>before your next production run.</span></h1>
        <p className="hero-description">One wrong label can mean wasted packaging, costly reprints, and delayed shipments. VeriLabel compares photographed product labels with your approved specifications, highlighting differences and unreadable fields so your team knows what needs attention.</p>
        <div className="hero-actions"><Link href="/inspect?demo=1" className="primary-button">Try a sample inspection <span aria-hidden="true">→</span></Link><Link href="/specs?new=1" className="outline-button">Create a specification</Link></div>
      </div>
      <div className="hero-visual">
        <div className="hero-hexagon" aria-hidden="true" />
        <JarIllustration />
        <div className="hero-pass"><p className="illustration-note">Illustrative example — not a real inspection result</p><VerificationCard /></div>
      </div>
      <ul className="hero-checks">{checks.map(c=><li key={c}><span aria-hidden="true">✓</span>{c}</li>)}</ul>
    </section>
    <section id="solutions" className="landing-features">
      <h2>Built for the checks your team already makes</h2>
      <div className="feature-grid">{features.map((f,i)=><article id={i===2 ? "resources" : i===3 ? "pricing" : undefined} key={f.title}><span className="feature-icon">{f.icon}</span><div><h3>{f.title}</h3><p>{f.text}</p></div></article>)}</div>
    </section>
  </div>;
}
