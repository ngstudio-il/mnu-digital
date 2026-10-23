"use client";
import { useEffect, useRef, useState } from "react";
import LogoMark from "@/components/LogoMark";
import type { LogoLayout } from "@/lib/types";

// A scaled copy of the guest menu header (390 px wide on a phone), plus a large copy of the
// logo frame where the logo can be zoomed and moved inside its frame.
const PHONE = 390;
const clamp = (n: number, lim: number) => Math.round(Math.min(lim, Math.max(-lim, n)) * 10) / 10;

type Props = {
  name: string; typeLabel: string; brand: string; onBrand: string; cover: string | null; logo: string | null; fontFamily: string; center: boolean;
  layout: LogoLayout; onLive: (l: LogoLayout) => void; onCommit: (l: LogoLayout) => void;
};

export default function HeaderEditor({ name, typeLabel, brand, onBrand, cover, logo, fontFamily, center, layout, onLive, onCommit }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const drag = useRef<{ x: number; y: number; start: LogoLayout } | null>(null);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / PHONE));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const at = (e: React.PointerEvent) => {
    const d = drag.current!, w = frame.current!.clientWidth;
    const lim = 50 * layout.zoom + 25;
    return { ...d.start, x: clamp(d.start.x + ((e.clientX - d.x) / w) * 100, lim), y: clamp(d.start.y + ((e.clientY - d.y) / w) * 100, lim) };
  };
  function down(e: React.PointerEvent<HTMLDivElement>) {
    e.preventDefault();
    drag.current = { x: e.clientX, y: e.clientY, start: layout };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) { if (drag.current) onLive(at(e)); }
  function up(e: React.PointerEvent) { if (!drag.current) return; const l = at(e); drag.current = null; onLive(l); onCommit(l); }
  function key(e: React.KeyboardEvent) {
    const d = { ArrowLeft: [-2, 0], ArrowRight: [2, 0], ArrowUp: [0, -2], ArrowDown: [0, 2] }[e.key];
    if (!d) return;
    e.preventDefault();
    const l = { ...layout, x: clamp(layout.x + d[0], 100), y: clamp(layout.y + d[1], 100) };
    onLive(l); onCommit(l);
  }
  function wheel(e: React.WheelEvent) {
    const l = { ...layout, zoom: Math.round(Math.min(3, Math.max(0.5, layout.zoom - e.deltaY * 0.002)) * 100) / 100 };
    onLive(l); onCommit(l);
  }

  const frameBg = cover ? "rgba(255,255,255,.9)" : "rgba(255,255,255,.12)";
  return (
    <div className="hdr-wrap">
      <div ref={box} className={`hdr-edit${center ? " center" : ""}`}
        style={{ ["--s" as string]: scale, color: cover ? "#fff" : onBrand, background: cover ? `linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,.05) 35%, rgba(0,0,0,.62)), url("${cover}") center / cover, ${brand}` : brand }}>
        <div className="hdr-pills" aria-hidden="true"><span>My orders</span><span>English</span></div>
        {logo && <LogoMark src={logo} layout={layout} className="hdr-logo" style={{ background: frameBg }} />}
        <small>{typeLabel.toUpperCase()}</small>
        <b style={{ fontFamily }}>{name}</b>
      </div>
      {logo && (
        <div className="logo-crop">
          <div ref={frame} className="logo-frame" style={{ background: cover ? frameBg : brand }} tabIndex={0} aria-label="Logo in its frame. Drag to move, scroll to zoom"
            onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onKeyDown={key} onWheel={wheel}>
            <LogoMark src={logo} layout={layout} className="logo-frame-in" style={cover ? undefined : { background: frameBg }} />
          </div>
          <span className="note">Drag to move the logo inside its frame</span>
        </div>
      )}
    </div>
  );
}
