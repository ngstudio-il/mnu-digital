"use client";
import { useEffect, useState } from "react";

// Shown to a Stripe subscriber we're moving to PayPal (see /api/admin/move-to-paypal) until they set up payment.
// "Later" hides it for this browser session only.
export default function BillingMove({ until }: { until: string | null }) {
  const [open, setOpen] = useState(false);
  useEffect(() => {
    try { if (sessionStorage.getItem("mnu_billing_move") === "later") return; } catch { /* storage blocked */ }
    setOpen(true);
  }, []);
  if (!open) return null;
  const day = until ? new Date(until).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" }) : null;
  const later = () => { try { sessionStorage.setItem("mnu_billing_move", "later"); } catch { /* storage blocked */ } setOpen(false); };
  return (
    <div className="overlay" style={{ zIndex: 70 }}>
      <div className="modal" role="dialog" aria-modal="true" aria-labelledby="bm-title" style={{ maxWidth: 460 }} translate="no">
        <div className="modal-head"><h3 id="bm-title">Keep your menu online</h3></div>
        <p className="note" style={{ fontSize: 15 }}>We’ve moved our payments to PayPal, so we’ve cancelled your old subscription. You won’t be charged there.</p>
        <p className="note" style={{ fontSize: 15 }}>{day ? `Your menu stays online until ${day}. ` : ""}To keep enjoying mnu.digital after that, set up your monthly subscription with PayPal ($39/month, starting today). Your menu, dishes and QR codes stay exactly as they are.</p>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end", marginTop: 18 }}>
          <button className="btn ghost" type="button" onClick={later}>Later</button>
          <a className="btn" href="/billing">Set up payment</a>
        </div>
      </div>
    </div>
  );
}
