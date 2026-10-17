"use client";

import type { PointerEvent } from "react";
import "./HotSauceHero.css";

type Props = { expanded: boolean; onActivate: () => void };

/** Preserve the original photograph; only its composited plane tilts in 3D. */
export default function HotSauceBottle({ expanded, onActivate }: Props) {
  function tilt(event: PointerEvent<HTMLButtonElement>) {
    if (event.pointerType !== "mouse" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const box = event.currentTarget.getBoundingClientRect();
    const x = Math.max(-1, Math.min(1, (event.clientX - box.left) / box.width * 2 - 1));
    const y = Math.max(-1, Math.min(1, (event.clientY - box.top) / box.height * 2 - 1));
    event.currentTarget.style.setProperty("--bottle-rotate-x", `${-y * 4.5}deg`);
    event.currentTarget.style.setProperty("--bottle-rotate-y", `${x * 7}deg`);
  }

  function reset(event: PointerEvent<HTMLButtonElement>) {
    event.currentTarget.style.removeProperty("--bottle-rotate-x");
    event.currentTarget.style.removeProperty("--bottle-rotate-y");
  }

  return (
    <button
      id="hot-sauce-trigger"
      type="button"
      className="hero-bottle hot-sauce-bottle"
      aria-label="Inspect the hot sauce bottle"
      aria-haspopup="dialog"
      aria-expanded={expanded}
      aria-controls={expanded ? "hot-sauce-result" : undefined}
      onClick={onActivate}
      onPointerMove={tilt}
      onPointerLeave={reset}
    >
      <span className="hot-sauce-art">
        {/* eslint-disable-next-line @next/next/no-img-element -- keep the exact original transparent product photograph */}
        <img className="hot-sauce-poster" src="/products/hero-hot-sauce.png" alt="" draggable={false} />
      </span>
      {!expanded && <span className="hot-sauce-hint">Click bottle to inspect <span aria-hidden="true">↗</span></span>}
    </button>
  );
}
