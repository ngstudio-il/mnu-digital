"use client";
import { useState } from "react";

// "Delete user" with a confirmation step: the admin types the user's email.
export default function DeleteUser({ userId, email, label = "Delete user", small = false, onDeleted }: { userId: string; email: string; label?: string; small?: boolean; onDeleted?: () => void }) {
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function run() {
    setBusy(true); setErr("");
    const res = await fetch("/api/admin/delete-user", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId, confirm: typed }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    if (!res?.ok) return setErr(json.error ?? "Couldn’t delete. Try again.");
    setOpen(false);
    if (onDeleted) onDeleted(); else window.location.href = "/admin/venues";
  }

  return (
    <>
      <button type="button" className={`btn danger ${small ? "sm" : "sm"}`} onClick={(e) => { e.stopPropagation(); setOpen(true); setTyped(""); setErr(""); }}>{label}</button>
      {open && (
        <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) setOpen(false); }} onClick={(e) => e.stopPropagation()}>
          <div className="modal del-modal" role="dialog" aria-modal="true" aria-labelledby="del-title">
            <div className="modal-head"><h3 id="del-title">Delete this user completely?</h3><button className="x" type="button" onClick={() => setOpen(false)} aria-label="Close" disabled={busy}>×</button></div>
            <p className="note">This can’t be undone. It permanently removes:</p>
            <ul className="del-list">
              <li>The account <b>{email}</b> (they can’t log in any more)</li>
              <li>Their venue, menu, photos, orders, chat and analytics</li>
              <li>Their Stripe subscription is cancelled right away (past payments stay in Stripe)</li>
            </ul>
            <label className="field" htmlFor="del-confirm">Type <b>{email}</b> to confirm
              <input id="del-confirm" value={typed} onChange={(e) => setTyped(e.target.value)} autoComplete="off" spellCheck={false} />
            </label>
            {err && <p className="note" style={{ color: "var(--coral)" }}>{err}</p>}
            <div className="modal-foot"><span />
              <div style={{ display: "flex", gap: 8 }}>
                <button className="btn ghost" type="button" onClick={() => setOpen(false)} disabled={busy}>Cancel</button>
                <button className="btn danger-solid" type="button" onClick={run} disabled={busy || typed.trim().toLowerCase() !== email.toLowerCase()}>{busy ? "Deleting…" : "Delete permanently"}</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
