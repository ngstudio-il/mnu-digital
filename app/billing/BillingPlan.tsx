"use client";
import "@/styles/app.css";
import "@/styles/auth.css";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import ScanShowcase from "@/components/marketing/ScanShowcase";
import BillingDetailsForm, { billingValid } from "@/components/billing/BillingDetailsForm";
import { guessCountry, type BillingDetails } from "@/lib/countries";

const FEATURES = [
  "Unlimited dishes, photos and menu views",
  "Orders from the table and takeaway, live",
  "QR codes for the menu and every table",
  "AI dish descriptions (1,000 a month)",
  "Your logo, colours and languages",
];

type PayPalButtons = { isEligible: () => boolean; render: (el: HTMLElement) => Promise<void> };
type PayPalSdk = { Buttons: (o: object) => PayPalButtons; FUNDING: { CARD: string; PAYPAL: string } };

export default function BillingPlan({ venueName, returning, provider, paypalClientId = "", billing: initialBilling }: { venueName: string; returning: boolean; provider: "paypal" | "stripe"; paypalClientId?: string; billing: BillingDetails | null }) {
  const via = provider === "paypal" ? "PayPal" : "Stripe";
  // The day the trial ends and the first $39 is charged.
  const [firstCharge, setFirstCharge] = useState("in 7 days");
  useEffect(() => { setFirstCharge(new Date(Date.now() + 7 * 86400000).toLocaleDateString("en-GB", { day: "numeric", month: "long" })); }, []);
  // Billing details for the invoice, saved before the payment starts.
  const placeholder = /^my venue$/i.test(venueName.trim()) ? "" : venueName;
  const [billing, setBilling] = useState<BillingDetails>(initialBilling ?? { country: "", name: placeholder, tax_id: "", address: "" });
  const billingRef = useRef(billing);
  billingRef.current = billing;
  useEffect(() => { if (!initialBilling) setBilling((b) => (b.country ? b : { ...b, country: guessCountry() })); }, [initialBilling]);
  const saveBilling = async () => {
    const res = await fetch("/api/billing/details", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(billingRef.current) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { setErr(json.error ?? "Couldn’t save your billing details. Try again."); return false; }
    return true;
  };
  const cardBox = useRef<HTMLDivElement>(null);
  const paypalBox = useRef<HTMLDivElement>(null);
  // PayPal's buttons, right on this page: pay by card (no PayPal account needed), or log in to PayPal.
  // If they can't load, the plain button below opens PayPal's own page instead.
  const [sdk, setSdk] = useState<"loading" | "ready" | "failed">(provider === "paypal" && paypalClientId ? "loading" : "failed");

  useEffect(() => {
    if (sdk !== "loading") return;
    const w = window as Window & { paypal?: PayPalSdk };
    const create = async () => {
      if (!(await saveBilling())) throw new Error("billing");
      const res = await fetch("/api/paypal/subscribe", { method: "POST" });
      const json = await res.json().catch(() => ({}));
      if (json.active) { window.location.href = "/dashboard"; throw new Error("active"); }
      if (!res.ok || !json.id) { setErr(json.error ?? "Couldn’t start the payment. Try again."); throw new Error("subscribe"); }
      return json.id as string;
    };
    const opts = (fundingSource: string, color: string) => ({
      fundingSource,
      style: { layout: "vertical", shape: "pill", height: 48, label: "subscribe", ...(color ? { color } : {}) },
      // Country and invoice name first; PayPal opens only once they're filled in.
      onClick: (_: unknown, actions: { resolve: () => unknown; reject: () => unknown }) => {
        if (!billingValid(billingRef.current)) { setErr("Add your country and the name for your invoices first."); document.getElementById("bd-country")?.focus(); return actions.reject(); }
        setErr(""); return actions.resolve();
      },
      createSubscription: create,
      onApprove: (data: { subscriptionID?: string }) => { setBusy(true); window.location.href = `/billing/paypal?subscription_id=${encodeURIComponent(data.subscriptionID ?? "")}`; },
      onError: () => setErr("The payment didn’t go through. Try again, or use another card."),
    });
    const draw = async () => {
      const pp = w.paypal;
      if (!pp || !cardBox.current || !paypalBox.current) return setSdk("failed");
      let shown = 0;
      for (const [box, b] of [[cardBox.current, pp.Buttons(opts(pp.FUNDING.CARD, "black"))], [paypalBox.current, pp.Buttons(opts(pp.FUNDING.PAYPAL, "gold"))]] as const) {
        if (b.isEligible()) { await b.render(box).catch(() => {}); shown++; }
      }
      setSdk(shown ? "ready" : "failed");
    };
    if (w.paypal) { draw(); return; }
    const s = document.createElement("script");
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(paypalClientId)}&vault=true&intent=subscription&components=buttons&enable-funding=card&locale=en_US`;
    s.async = true;
    s.onload = () => { draw(); };
    s.onerror = () => setSdk("failed");
    document.head.appendChild(s);
    const timer = setTimeout(() => setSdk((v) => (v === "loading" ? "failed" : v)), 12000);
    return () => clearTimeout(timer);
  }, [sdk, paypalClientId]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function start() {
    if (provider === "paypal" && !billingValid(billing)) { setErr("Add your country and the name for your invoices first."); return; }
    setBusy(true); setErr("");
    if (provider === "paypal" && !(await saveBilling())) { setBusy(false); return; }
    const res = await fetch(provider === "paypal" ? "/api/paypal/subscribe" : "/api/stripe/checkout", { method: "POST" }).catch(() => null);
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
          <p className="sub">{returning ? `Pick up where ${placeholder || "you"} left off.` : `Get ${placeholder || "your menu"} online today, free for the first 7 days.`}</p>
          {/* On phones the dark showcase panel is hidden, so a smaller copy of it sits here. */}
          <div className="ss-mobile" aria-hidden="true"><ScanShowcase /></div>

          <div className="plan-box">
            {returning ? (
              <div className="plan-price"><b>$39</b><span>/month</span></div>
            ) : (
              <>
                <span className="trial-pill">7 days free</span>
                <div className="plan-price"><b>$0</b><span>today</span></div>
                <p className="plan-then">then $39/month from {firstCharge}. Cancel anytime before and pay nothing.</p>
              </>
            )}
            <ul className="perks dark">{FEATURES.map((f) => <li key={f}>{f}</li>)}</ul>
            {!returning && (
              <ol className="trial-steps">
                <li><b>Today</b><span>Full access, payment set up securely with {via}</span></li>
                <li><b>Day 7</b><span>First charge of $39, then monthly</span></li>
                <li><b>Anytime</b><span>Cancel before day 7 and pay nothing</span></li>
              </ol>
            )}
          </div>

          {provider === "paypal" && (
            <fieldset className="bd-box">
              <legend>Billing details</legend>
              <p className="note">For your invoices. You can change them later in Settings.</p>
              <BillingDetailsForm value={billing} onChange={setBilling} />
            </fieldset>
          )}
          {!returning && (
            <div className="trial-note">
              <b>Try everything free for 7 days</b>
              <span>Nothing is charged today. Your first payment of $39 is on {firstCharge}, and you can cancel before then in one click.</span>
            </div>
          )}
          <p className="err" aria-live="polite">{err}</p>
          {provider === "paypal" && sdk !== "failed" && (
            <div className="pp-buttons" aria-busy={sdk === "loading"}>
              {sdk === "loading" && <p className="note" style={{ textAlign: "center" }}>Loading secure payment…</p>}
              <div ref={cardBox} />
              {sdk === "ready" && <p className="pp-or"><span>or</span></p>}
              <div ref={paypalBox} />
            </div>
          )}
          {(provider !== "paypal" || sdk === "failed") && <button className="btn block" type="button" onClick={start} disabled={busy}>{busy ? `Opening ${via}…` : returning ? `Continue to payment with ${via}` : `Start free trial with ${via}`}</button>}
          <p className="legal">{provider === "paypal" ? "Pay with a debit or credit card, no PayPal account needed, or log in to PayPal. Payments are processed securely by PayPal; we never see your card number." : "Payments are processed by Stripe. We never see your card number."}</p>
        </div>
      </section>
      <aside className="auth-side" aria-hidden="true">
        <h2>Your menu, live tonight.</h2>
        <ul className="perks"><li>7 days free, cancel anytime</li><li>Guests scan, browse and order</li><li>Orders land in your dashboard instantly</li></ul>
        <ScanShowcase />
      </aside>
    </div>
  );
}
