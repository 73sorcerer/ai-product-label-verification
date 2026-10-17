"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Check, ShieldCheck, X } from "lucide-react";
import HotSauceBottle from "./HotSauceBottle";
import "./HotSauceHero.css";

const fields = [
  ["Product name", "Original Hot Sauce"],
  ["Net weight", "12 oz (340 g)"],
  ["Ingredients", "Matches specification"],
  ["Allergens", "None"],
  ["Barcode", "0123456789029"],
];

export default function HotSauceHero() {
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const close = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    close.current?.focus({ preventScroll: true });
    function outside(event: PointerEvent) {
      if (event.target instanceof Node && !container.current?.contains(event.target)) setOpen(false);
    }
    function escape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setOpen(false);
        document.getElementById("hot-sauce-trigger")?.focus({ preventScroll: true });
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("pointerdown", outside);
      document.removeEventListener("keydown", escape);
    };
  }, [open]);

  function dismiss() {
    setOpen(false);
    document.getElementById("hot-sauce-trigger")?.focus({ preventScroll: true });
  }

  return (
    <div ref={container} className="hero-bottle-container">
      <HotSauceBottle expanded={open} onActivate={() => setOpen(value => !value)} />
      {open && (
        <div className="hot-sauce-popup">
          <p id="hot-sauce-result-caption" className="hot-sauce-caption">Illustrative example — not a real inspection result</p>
          <section id="hot-sauce-result" role="dialog" aria-labelledby="hot-sauce-result-title" aria-describedby="hot-sauce-result-caption" className="hot-sauce-card">
            <button ref={close} type="button" className="hot-sauce-close" aria-label="Close sample inspection" onClick={dismiss}><X size={16} /></button>
            <header className="hot-sauce-header">
              <span className="hot-sauce-seal"><ShieldCheck size={28} strokeWidth={1.75} aria-hidden="true" /></span>
              <div><p className="hot-sauce-eyebrow">Sample inspection</p><h2 id="hot-sauce-result-title">Pass</h2><p className="hot-sauce-summary">5 of 5 fields match</p></div>
            </header>
            <ul className="hot-sauce-fields">{fields.map(([name, value]) => <li key={name}><span><strong>{name}</strong><small>{value}</small></span><span className="hot-sauce-match" aria-label="Match"><Check size={14} strokeWidth={2.5} aria-hidden="true" /></span></li>)}</ul>
            <Link href="/inspect?demo=1" className="hot-sauce-action">Try a sample inspection <ArrowUpRight size={16} aria-hidden="true" /></Link>
          </section>
        </div>
      )}
    </div>
  );
}
