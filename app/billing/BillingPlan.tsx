"use client";
import "@/styles/app.css";
import "@/styles/auth.css";
import { useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const FEATURES = [
  "Unlimited dishes, photos and menu views",
  "Orders from the table and takeaway, live",
  "QR codes for the menu and every table",
  "AI dish descriptions (1,000 a month)",
  "Your logo, colours and languages",
];

export default function BillingPlan({ venueName, returning }: { venueName: string; returning: boolean }) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function start() {
    setBusy(true); setErr("");
    const res = await fetch("/api/stripe/checkout", { method: "POST" }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok || !json.url) { setErr(json.error ?? "Couldn’t open checkout. Try again."); setBusy(false); return; }
    window.location.href = json.url;
  }

  async function logout() {
    await supabaseBrowser().auth.signOut();
    window.location.href = "/login";
  }

  return (
    <div className="auth">
      <section className="auth-form">
        <div className="auth-top">
          <a className="logo" href="/"><img src="/assets/mnu-logo.png" alt="mnu.digital" /></a>
          <button className="back" type="button" onClick={logout} style={{ background: "none", border: 0, cursor: "pointer" }}>Log out</button>
        </div>
        <div className="auth-box">
          <h1>{returning ? "Reactivate your menu" : "Start your 7-day free trial"}</h1>
          <p className="sub">{returning ? `Pick up where ${venueName} left off.` : `Get ${venueName} online today. You won’t be charged until day 7.`}</p>

          <div className="plan-box">
            <div className="plan-price"><b>$39</b><span>/month</span></div>
            <ul className="perks dark">{FEATURES.map((f) => <li key={f}>{f}</li>)}</ul>
            {!returning && (
              <ol className="trial-steps">
                <li><b>Today</b><span>Full access, card saved securely with Stripe</span></li>
                <li><b>Day 7</b><span>First charge of $39, then monthly</span></li>
                <li><b>Anytime</b><span>Cancel in Settings before day 7 and pay nothing</span></li>
              </ol>
            )}
          </div>

          <p className="err" aria-live="polite">{err}</p>
          <button className="btn block" type="button" onClick={start} disabled={busy}>{busy ? "Opening secure checkout…" : returning ? "Continue to payment" : "Start free trial"}</button>
          <p className="legal">Payments are processed by Stripe. We never see your card number.</p>
        </div>
      </section>
      <aside className="auth-side light" aria-hidden="true">
        <h2>Your menu, live tonight.</h2>
        <ul className="perks"><li>7 days free, cancel anytime</li><li>Menu, photos and prices in one place</li><li>Take orders straight from the table</li></ul>
      </aside>
    </div>
  );
}
