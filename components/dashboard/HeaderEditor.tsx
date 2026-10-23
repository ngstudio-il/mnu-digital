"use client";
import { useEffect, useRef, useState } from "react";
import type { LogoLayout } from "@/lib/types";

// A scaled copy of the guest menu header (390 px wide on a phone) where the logo can be dragged anywhere.
const PHONE = 390;
const clamp = (n: number) => Math.round(Math.min(100, Math.max(0, n)) * 10) / 10;

type Props = { name: string; typeLabel: string; brand: string; onBrand: string; cover: string | null; logo: string | null; fontFamily: string; center: boolean; layout: LogoLayout; onChange: (l: LogoLayout) => void };

export default function HeaderEditor({ name, typeLabel, brand, onBrand, cover, logo, fontFamily, center, layout, onChange }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const img = useRef<HTMLImageElement>(null);
  const [scale, setScale] = useState(1);
  const [live, setLive] = useState<LogoLayout>(layout);
  const drag = useRef<{ dx: number; dy: number } | null>(null);

  useEffect(() => setLive(layout), [layout]);
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setScale(el.clientWidth / PHONE));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Left edge sits at x% of the free space, so 0 is flush left and 100 flush right (same for y).
  function place(clientX: number, clientY: number) {
    const b = box.current!.getBoundingClientRect();
    const w = img.current!.offsetWidth, h = img.current!.offsetHeight;
    const x = ((clientX - b.left - drag.current!.dx) / Math.max(1, b.width - w)) * 100;
    const y = ((clientY - b.top - drag.current!.dy) / Math.max(1, b.height - h)) * 100;
    return { ...live, x: clamp(x), y: clamp(y) };
  }
  function down(e: React.PointerEvent<HTMLImageElement>) {
    e.preventDefault();
    const r = e.currentTarget.getBoundingClientRect();
    drag.current = { dx: e.clientX - r.left, dy: e.clientY - r.top };
    e.currentTarget.setPointerCapture(e.pointerId);
  }
  function move(e: React.PointerEvent) { if (drag.current) setLive(place(e.clientX, e.clientY)); }
  function up(e: React.PointerEvent) {
    if (!drag.current) return;
    const next = place(e.clientX, e.clientY);
    drag.current = null;
    setLive(next);
    onChange(next);
  }
  function key(e: React.KeyboardEvent) {
    const step = e.shiftKey ? 10 : 2;
    const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
    if (!d) return;
    e.preventDefault();
    const next = { ...live, x: clamp((live.x ?? 0) + d[0]), y: clamp((live.y ?? 70) + d[1]) };
    setLive(next); onChange(next);
  }

  const free = live.x !== null && live.y !== null;
  const size = live.size * scale;
  return (
    <div
      ref={box}
      className={`hdr-edit${center ? " center" : ""}`}
      style={{ ["--s" as string]: scale, color: cover ? "#fff" : onBrand, background: cover ? `linear-gradient(180deg, rgba(0,0,0,.28), rgba(0,0,0,.05) 35%, rgba(0,0,0,.62)), url("${cover}") center / cover, ${brand}` : brand }}
      onPointerMove={move} onPointerUp={up} onPointerCancel={up}
    >
      <div className="hdr-pills" aria-hidden="true"><span>My orders</span><span>English</span></div>
      {logo && (
        <img
          ref={img} src={logo} alt="Logo, drag to move" draggable={false} tabIndex={0}
          className={`hdr-logo${free ? " free" : ""}${cover ? " on-cover" : ""}`}
          style={{ width: size, height: size, ...(free ? { left: `${live.x}%`, top: `${live.y}%`, transform: `translate(-${live.x}%, -${live.y}%)` } : {}) }}
          onPointerDown={down} onKeyDown={key}
        />
      )}
      <small>{typeLabel.toUpperCase()}</small>
      <b style={{ fontFamily }}>{name}</b>
    </div>
  );
}
