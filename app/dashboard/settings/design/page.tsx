"use client";
import { useCallback, useRef } from "react";
import { useDash } from "@/components/dashboard/VenueContext";
import LookAndFeel from "@/components/dashboard/LookAndFeel";
import type { Venue } from "@/lib/types";

// Design settings next to a live guest view. The preview is the real guest menu in a frame;
// design changes are posted to it as they happen, so colours and the logo update while dragging.
export default function DesignSettings() {
  const { venue } = useDash();
  const frame = useRef<HTMLIFrameElement>(null);
  const latest = useRef<Partial<Venue>>({});

  const send = useCallback(() => {
    frame.current?.contentWindow?.postMessage({ type: "mnu:design", design: latest.current }, window.location.origin);
  }, []);
  const onPreview = useCallback((p: Partial<Venue>) => { latest.current = p; send(); }, [send]);

  return (
    <div className="design-grid">
      <LookAndFeel onPreview={onPreview} />
      <aside className="guest-view">
        <div className="guest-view-head"><b>Guest view</b><a href={`/m/${venue.slug}`} target="_blank" rel="noreferrer">Open menu ↗</a></div>
        <div className="guest-phone">
          <iframe ref={frame} src={`/m/${venue.slug}?preview=1`} title="Guest view of your menu" onLoad={send} />
        </div>
        <p className="note">Changes show here right away. Orders placed from this preview are real.</p>
      </aside>
    </div>
  );
}
