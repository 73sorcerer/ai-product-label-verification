"use client";
import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ChevronLeft, ChevronRight, RotateCcw } from "lucide-react";
import "./HotSauceHero.css";
type Props = {
    expanded: boolean;
    onActivate: () => void;
};
type Scene = ReturnType<typeof import("./hot-sauce-scene").createBottleScene>;
export default function HotSauceBottle({ expanded, onActivate }: Props) {
    const host = useRef<HTMLSpanElement>(null), scene = useRef<Scene | null>(null);
    const drag = useRef<{
        x: number;
        angle: number;
        moved: boolean;
        time: number;
        lastMove: number;
    } | null>(null);
    const suppressClick = useRef(false);
    const [ready, setReady] = useState(false), [reduced, setReduced] = useState(false);
    useEffect(() => {
        let cancelled = false;
        const element = host.current!, media = window.matchMedia("(prefers-reduced-motion: reduce)");
        const changed = () => { drag.current = null; setReduced(media.matches); };
        media.addEventListener("change", changed);
        import("./hot-sauce-scene").then(async ({ createBottleScene, loadBottlePhoto }) => {
            const photo = await loadBottlePhoto();
            if (cancelled)
                return;
            try {
                scene.current = createBottleScene(element, () => { scene.current?.dispose(); scene.current = null; setReady(false); }, photo);
                setReduced(media.matches);
                setReady(true);
            }
            catch {
                setReady(false);
            }
        }).catch(() => { if (!cancelled)
            setReady(false); });
        return () => { cancelled = true; media.removeEventListener("change", changed); scene.current?.dispose(); scene.current = null; };
    }, []);
    function start(event: PointerEvent<HTMLButtonElement>) {
        if (!ready || !event.isPrimary || event.button !== 0)
            return;
        const angle = scene.current?.beginDrag();
        if (angle == null)
            return;
        suppressClick.current = false;
        drag.current = { x: event.clientX, angle, moved: false, time: event.timeStamp, lastMove: event.timeStamp };
        event.currentTarget.setPointerCapture(event.pointerId);
    }
    function move(event: PointerEvent<HTMLButtonElement>) {
        const current = drag.current;
        if (!current)
            return;
        const distance = event.clientX - current.x;
        if (Math.abs(distance) > 6)
            current.moved = true;
        if (current.moved) {
            scene.current?.dragTo(current.angle + distance / event.currentTarget.clientWidth * 360, event.timeStamp - current.time);
            current.lastMove = event.timeStamp;
        }
        current.time = event.timeStamp;
    }
    function end(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
        const current = drag.current;
        if (!current)
            return;
        suppressClick.current = current.moved;
        scene.current?.endDrag(!cancelled && current.moved, event.timeStamp - current.lastMove);
        drag.current = null;
    }
    return <div className="hot-sauce-product">
    <button id="hot-sauce-trigger" type="button" className="hero-bottle hot-sauce-bottle" data-reduced-motion={reduced} aria-label="Inspect the hot sauce bottle" aria-haspopup="dialog" aria-expanded={expanded} aria-describedby={ready ? "hot-sauce-rotation-help" : undefined} aria-controls={expanded ? "hot-sauce-result" : undefined} onClick={event => { if (event.detail === 0 || !suppressClick.current)
        onActivate(); suppressClick.current = false; }} onPointerDown={start} onPointerMove={move} onPointerUp={event => end(event)} onPointerCancel={event => end(event, true)} onLostPointerCapture={event => end(event, true)} onKeyDown={event => {
            if (!ready)
                return;
            if (event.key === "ArrowLeft" || event.key === "ArrowRight" || event.key === "Home") {
                event.preventDefault();
                if (event.key === "Home")
                    scene.current?.reset();
                else
                    scene.current?.step(event.key === "ArrowLeft" ? -1 : 1);
            }
        }}>
      <span className="hot-sauce-art" data-ready={ready}>
        {/* eslint-disable-next-line @next/next/no-img-element -- original photograph during loading/no WebGL */}
        <img className="hot-sauce-poster" src="/products/hero-hot-sauce.png" alt="" draggable={false}/>
        <span ref={host} className="hot-sauce-canvas"/>
      </span>
      {!expanded && <span className="hot-sauce-hint">Click bottle to inspect <span aria-hidden="true">↗</span></span>}
    </button>
    {ready && <><span id="hot-sauce-rotation-help" className="sr-only">{reduced ? "Use the arrow buttons or keys to turn 45 degrees. " : "Drag to spin freely, or use the arrow buttons or keys to turn 45 degrees. "}Home resets the view. Press Enter to inspect.</span><div className="hot-sauce-controls" role="group" aria-label="Rotate the bottle">
      <button type="button" aria-label="Turn bottle left" onClick={() => scene.current?.step(-1)}><ChevronLeft size={16}/></button>
      <button type="button" className="hot-sauce-reset" aria-label="Reset bottle to front" onClick={() => scene.current?.reset()}><RotateCcw size={12}/>{reduced ? "Turn bottle" : "Drag to turn"}</button>
      <button type="button" aria-label="Turn bottle right" onClick={() => scene.current?.step(1)}><ChevronRight size={16}/></button>
    </div></>}
  </div>;
}
