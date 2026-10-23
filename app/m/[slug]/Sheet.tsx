"use client";
import { useRef, useState } from "react";

// Bottom sheet that closes on a tap outside or a swipe down.
export default function Sheet({ onClose, label, className = "", closeLabel = "Close", children }: { onClose: () => void; label: string; className?: string; closeLabel?: string; children: React.ReactNode }) {
  const sheet = useRef<HTMLDivElement>(null);
  const start = useRef<number | null>(null);
  const [dy, setDy] = useState(0);

  function down(e: React.TouchEvent) {
    // Only start a swipe when the sheet is scrolled to the top, so normal scrolling still works.
    start.current = (sheet.current?.scrollTop ?? 0) <= 0 ? e.touches[0].clientY : null;
  }
  function move(e: React.TouchEvent) {
    if (start.current === null) return;
    const d = e.touches[0].clientY - start.current;
    setDy(d > 0 ? d : 0);
  }
  function up() {
    if (start.current !== null && dy > 90) onClose();
    else setDy(0);
    start.current = null;
  }

  return (
    <div className="g-sheet-wrap" onClick={onClose} style={{ background: dy ? `rgba(20,26,27,${Math.max(0.1, 0.45 - dy / 800)})` : undefined }}>
      <div
        ref={sheet}
        className={`g-sheet ${className}`}
        role="dialog"
        aria-label={label}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={down}
        onTouchMove={move}
        onTouchEnd={up}
        onTouchCancel={up}
        style={{ transform: dy ? `translateY(${dy}px)` : undefined, transition: start.current === null ? "transform .25s ease" : "none" }}
      >
        <button type="button" className="g-grab" onClick={onClose} aria-label={closeLabel}><i /></button>
        {children}
      </div>
    </div>
  );
}
