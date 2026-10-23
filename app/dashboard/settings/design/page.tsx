"use client";
import { useCallback, useRef } from "react";
import { useDash } from "@/components/dashboard/VenueContext";
import LookAndFeel from "@/components/dashboard/LookAndFeel";
import GuestView from "@/components/dashboard/GuestView";
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
      <GuestView ref={frame} slug={venue.slug} onLoad={send} note="Changes show here right away. Orders placed from this preview are real." />
    </div>
  );
}
