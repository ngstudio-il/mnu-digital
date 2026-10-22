"use client";
import { useState } from "react";

const PACKS = [
  { id: "p50", credits: 50, price: "$9", per: "18¢ per image" },
  { id: "p200", credits: 200, price: "$29", per: "15¢ per image", best: true },
];

export default function ImagePacks({ onClose }: { onClose: () => void }) {
  const [busy, setBusy] = useState("");
  const [err, setErr] = useState("");

  async function buy(pack: string) {
    setBusy(pack); setErr("");
    const res = await fetch("/api/stripe/image-pack", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ pack }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok || !json.url) { setErr(json.error ?? "Couldn’t open checkout."); setBusy(""); return; }
    window.location.href = json.url;
  }

  return (
    <div className="overlay" style={{ zIndex: 60 }} onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="packs-title" style={{ maxWidth: 520 }}>
        <div className="modal-head"><h3 id="packs-title">More AI images</h3><button className="x" type="button" onClick={onClose} aria-label="Close">×</button></div>
        <p className="note">Your plan includes AI images every month (10 during the trial, 30 on the paid plan). Packs are for when you need more. Pack images never expire and are used after your monthly ones.</p>
        <div className="packs">
          {PACKS.map((p) => (
            <button key={p.id} type="button" className={`pack${p.best ? " best" : ""}`} onClick={() => buy(p.id)} disabled={!!busy}>
              {p.best && <i>Best value</i>}
              <b>{p.credits} images</b>
              <strong>{p.price}</strong>
              <span>{p.per}</span>
              <em>{busy === p.id ? "Opening checkout…" : "Buy"}</em>
            </button>
          ))}
        </div>
        {err && <p className="note" style={{ color: "var(--coral)" }}>{err}</p>}
        <p className="note">One-time payment through Stripe. No subscription change.</p>
      </div>
    </div>
  );
}
