"use client";
import { useState } from "react";

// Admin → Overview: builds (or rebuilds) the example menu at /m/demo, linked from /lp2's "Menu example".
// Runs the steps one by one: venue and dishes, cover photo, translations, then AI photos for the dishes.
export default function DemoMenu() {
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const say = (s: string) => setLog((l) => [...l, s]);
  const post = async (url: string, body: object) => {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    return { ok: !!res?.ok, json };
  };

  async function build() {
    if (!window.confirm("Build the demo menu at /m/demo? Any earlier demo menu is replaced.")) return;
    setBusy(true); setLog([]);
    const seed = await post("/api/admin/demo-menu", { step: "seed" });
    if (!seed.ok) { say(`✕ ${seed.json.error ?? "Couldn’t create it."}`); return setBusy(false); }
    say(`✓ Menu created: ${seed.json.dishes} dishes`);
    const cover = await post("/api/admin/demo-menu", { step: "cover" });
    say(cover.json.note ? `• Cover: used a site photo (${cover.json.note})` : "✓ Cover photo created");
    for (const lang of seed.json.langs as string[]) {
      const tr = await post("/api/admin/demo-menu", { step: "translate", lang });
      say(tr.ok ? `✓ Translated to ${lang}` : `✕ ${lang}: ${tr.json.error ?? "failed"}`);
    }
    let left = seed.json.missingPhotos as number;
    for (let round = 0; left > 0 && round < 20; round++) {
      say(`… Creating dish photos, ${left} left`);
      const img = await post("/api/admin/generate-images", { venueId: seed.json.venueId });
      if (!img.ok || img.json.done === 0) { say(`✕ Photos stopped: ${img.json.error ?? img.json.errors?.[0] ?? "no photo could be made"}`); break; }
      left = img.json.remaining;
    }
    if (left === 0) say("✓ All dish photos ready");
    say("Done. Open mnu.digital/m/demo");
    setBusy(false);
  }

  return (
    <div className="card">
      <div className="card-head"><h3>Demo menu</h3><a href="/m/demo" target="_blank" rel="noreferrer">Open /m/demo ↗</a></div>
      <p className="note">The example menu behind “Menu example” on /lp2: a restaurant with every feature on. It’s under your account and needs no subscription. Building it takes a few minutes (AI photos and translations).</p>
      <button className="btn sm" type="button" onClick={build} disabled={busy} style={{ marginTop: 12 }}>{busy ? "Building…" : "Build demo menu"}</button>
      {log.length > 0 && <ul className="demo-log">{log.map((l, i) => <li key={i}>{l}</li>)}</ul>}
    </div>
  );
}
