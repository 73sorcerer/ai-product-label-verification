/* eslint-disable @next/next/no-img-element -- local product photography */
import Link from "next/link";
import { ClipboardCheck, ScanText, TriangleAlert, History, Check } from "lucide-react";

const checks = [
  "Compare against approved specs",
  "Find mismatches and missing info",
  "Keep inspection records",
];

const features = [
  { title: "Reference", text: "Compare against your saved product specifications.", icon: ClipboardCheck },
  { title: "Detection", text: "Extract readable text from uploaded label images.", icon: ScanText },
  { title: "Review", text: "Flag differences and uncertain text for attention.", icon: TriangleAlert },
  { title: "Traceability", text: "Revisit saved inspection results when available.", icon: History },
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
        <h1><span className="headline-lead">Catch label mistakes</span><span className="headline-followup">before your next production run.</span></h1>
        <p className="hero-description">One wrong label can mean wasted packaging, costly reprints, and delayed shipments. VeriLabel compares photographed product labels with your approved specifications, highlighting differences and unreadable fields so your team knows what needs attention.</p>
        <div className="hero-actions"><Link href="/inspect?demo=1" className="primary-button">Try a sample inspection <span aria-hidden="true">→</span></Link><Link href="/specs?new=1" className="outline-button">Create a specification</Link></div>
        <ul className="hero-checks">{checks.map(c=><li key={c}><Check size={16} strokeWidth={2} aria-hidden="true" />{c}</li>)}</ul>
      </div>
      <div className="hero-visual">
        <div className="hero-hexagon" aria-hidden="true" />
        <div className="hero-bottle-container">
          <JarIllustration />
          <div className="hero-pass"><p className="illustration-note">Illustrative example — not a real inspection result</p><VerificationCard /></div>
        </div>
      </div>
    </section>
    <section id="solutions" className="landing-features">
      <h2>Built for the checks your team already makes</h2>
      <div className="feature-grid">{features.map((f,i)=><article id={i===2 ? "resources" : i===3 ? "pricing" : undefined} key={f.title}><span className="feature-icon"><f.icon size={24} strokeWidth={1.75} aria-hidden="true" /></span><div><h3>{f.title}</h3><p>{f.text}</p></div></article>)}</div>
    </section>
  </div>;
}
