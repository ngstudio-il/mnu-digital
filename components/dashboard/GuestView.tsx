"use client";
import { forwardRef } from "react";

// The real guest menu in a phone frame, used on the Menu page and in Settings → Design.
// `version` reloads it (after dish changes); the Design page also posts live design changes into it.
const GuestView = forwardRef<HTMLIFrameElement, { slug: string; version?: number; onLoad?: () => void; note?: string }>(function GuestView({ slug, version = 0, onLoad, note }, ref) {
  return (
    <aside className="guest-view">
      <div className="guest-view-head"><b>Guest view</b><a href={`/m/${slug}`} target="_blank" rel="noreferrer">Open menu ↗</a></div>
      <div className="guest-phone">
        <iframe ref={ref} src={`/m/${slug}?preview=1${version ? `&v=${version}` : ""}`} title="Guest view of your menu" onLoad={onLoad} />
      </div>
      {note && <p className="note">{note}</p>}
    </aside>
  );
});
export default GuestView;
