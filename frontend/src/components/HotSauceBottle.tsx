"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import "./HotSauceHero.css";

type Props = { expanded: boolean; onActivate: () => void };
type Scene = ReturnType<typeof import("./hot-sauce-scene").createBottleScene>;

export default function HotSauceBottle({ expanded, onActivate }: Props) {
  const host = useRef<HTMLSpanElement>(null);
  const scene = useRef<Scene | null>(null);
  const rotation = useRef(0);
  const drag = useRef<{ x: number; angle: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);
  const [ready, setReady] = useState(false);
  const [angle, setAngle] = useState(0);
  useEffect(() => {
    let cancelled = false;
    const element = host.current!;
    import("./hot-sauce-scene").then(({ createBottleScene }) => {
      if (cancelled) return;
      try {
        scene.current = createBottleScene(element, () => { scene.current?.dispose(); scene.current = null; setReady(false); });
        scene.current.rotate(rotation.current); setReady(true);
      } catch { setReady(false); }
    }).catch(() => { if (!cancelled) setReady(false); });
    return () => { cancelled = true; scene.current?.dispose(); scene.current = null; };
  }, []);

  function rotate(degrees: number) {
    const next = Math.max(-90, Math.min(90, degrees));
    rotation.current = next; setAngle(next); scene.current?.rotate(next);
  }
  function start(event: PointerEvent<HTMLButtonElement>) {
    if (!ready || !event.isPrimary || event.button !== 0) return;
    suppressClick.current = false;
    drag.current = { x: event.clientX, angle: rotation.current, moved: false };
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  function move(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    const distance = event.clientX - drag.current.x;
    if (Math.abs(distance) > 6) drag.current.moved = true;
    if (drag.current.moved) rotate(drag.current.angle + distance / event.currentTarget.clientWidth * 180);
  }
  function end() {
    suppressClick.current = drag.current?.moved ?? false; drag.current = null;
  }
  return (
    <div className="hot-sauce-product">
      <button id="hot-sauce-trigger" type="button" className="hero-bottle hot-sauce-bottle"
        aria-label="Inspect the hot sauce bottle" aria-haspopup="dialog" aria-expanded={expanded}
        aria-describedby={ready ? "hot-sauce-rotation-help" : undefined}
        aria-controls={expanded ? "hot-sauce-result" : undefined}
        onClick={event => { if (event.detail === 0 || !suppressClick.current) onActivate(); suppressClick.current = false; }}
        onPointerDown={start} onPointerMove={move} onPointerUp={end} onPointerCancel={end}
        onKeyDown={event => {
          if (!ready) return;
          if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home") {
            event.preventDefault(); rotate(event.key === "Home" ? 0 : rotation.current + (event.key === "ArrowLeft" ? -15 : 15));
          }
        }}>
        <span className="hot-sauce-art" data-ready={ready}>
          {/* eslint-disable-next-line @next/next/no-img-element -- original photo is the loading and no-WebGL fallback */}
          <img className="hot-sauce-poster" src="/products/hero-hot-sauce.png" alt="" draggable={false} />
          <span ref={host} className="hot-sauce-canvas" />
        </span>
        {!expanded && <span className="hot-sauce-hint">Click bottle to inspect <span aria-hidden="true">↗</span></span>}
      </button>
      {ready && <><span id="hot-sauce-rotation-help" className="sr-only">Drag or use the left and right arrow keys to turn up to 90 degrees each way. Home resets the view. Press Enter to inspect.</span><div className="hot-sauce-controls" role="group" aria-label="Rotate the bottle">
        <button type="button" aria-label="Turn bottle left" disabled={angle <= -90} onClick={() => rotate(rotation.current - 30)}><ChevronLeft size={16} /></button>
        <button type="button" className="hot-sauce-reset" aria-label="Reset bottle to front" onClick={() => rotate(0)}><RotateCcw size={12} />Drag to turn</button>
        <button type="button" aria-label="Turn bottle right" disabled={angle >= 90} onClick={() => rotate(rotation.current + 30)}><ChevronRight size={16} /></button>
      </div></>}
    </div>
  );
}
