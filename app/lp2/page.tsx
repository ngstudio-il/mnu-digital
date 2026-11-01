import type { Metadata } from "next";
import "@/styles/lp2.css";

// A short landing page for ad campaigns: the same story as the home page, told in a few blocks,
// with the live example menu (/m/demo, built from Admin → Demo menu) on the phone.
export const metadata: Metadata = {
  title: "Digital QR menu for restaurants · mnu.digital",
  description: "Guests scan, browse and order from a menu that looks as good as your food. Free for 7 days.",
  robots: { index: false, follow: true },
};

const FEATURES = [
  { title: "Change it here. See it there.", text: "Update dishes and prices from your phone. Guests see it the moment you save.", icon: <><path d="M4 12a8 8 0 0 1 14-5.3M20 12a8 8 0 0 1-14 5.3" /><path d="M18 3v4h-4M6 21v-4h4" /></> },
  { title: "Speaks your guest’s language", text: "English, Hebrew, Arabic and more in one menu. AI does the translating.", icon: <><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" /></> },
  { title: "Orders from the table", text: "Dine-in, takeaway and delivery orders land in your dashboard live.", icon: <><path d="M6 7h12l-1 13H7z" /><path d="M9 7V5a3 3 0 0 1 6 0v2" /></> },
  { title: "One QR, forever", text: "Print it once. The menu behind it changes as often as you like.", icon: <><rect x="4" y="4" width="6" height="6" rx="1" /><rect x="14" y="4" width="6" height="6" rx="1" /><rect x="4" y="14" width="6" height="6" rx="1" /><path d="M14 14h2v2h-2zM18 18h2v2h-2zM14 18h2M18 14h2" /></> },
];

const STEPS = [
  ["Photograph your menu", "Snap the printed menu or send a PDF. AI pulls in every dish and price."],
  ["Make it yours", "Your logo, colours, fonts and dish photos."],
  ["Place the QR code", "Put it on the tables. Guests scan and order."],
];

export default function Lp2() {
  return (
    <div className="l2">
      <header className="l2-head">
        <a href="/" className="l2-logo"><img src="/assets/mnu-logo.png" alt="mnu.digital" /></a>
        <nav><a className="l2-login" href="/login">Log in</a><a className="l2-btn sm" href="/signup">Start for Free</a></nav>
      </header>

      <section className="l2-hero">
        <div className="l2-copy">
          <span className="l2-pill"><i />QR menus · no app needed</span>
          <h1>Your menu, <span>beautifully digital</span></h1>
          <p>Guests scan, browse and order from a menu that looks as good as your food. You update dishes and prices from your phone.</p>
          <div className="l2-ctas">
            <a className="l2-btn" href="/signup">Start for Free</a>
            <a className="l2-btn ghost" href="/m/demo" target="_blank" rel="noreferrer">Menu example →</a>
          </div>
          <small className="l2-note">7 days free · then $39/month · cancel anytime</small>
        </div>
        <div className="l2-stage">
          <div className="l2-glow" aria-hidden="true" />
          <div className="l2-phone"><iframe src="/m/demo?preview=1" title="Example menu" loading="lazy" /></div>
          <a className="l2-try" href="/m/demo" target="_blank" rel="noreferrer">Open the example menu ↗</a>
        </div>
      </section>

      <section className="l2-block">
        <h2>Less printing, more control</h2>
        <div className="l2-features">
          {FEATURES.map((f) => (
            <div className="l2-card" key={f.title}>
              <span className="l2-icon"><svg viewBox="0 0 24 24" aria-hidden="true">{f.icon}</svg></span>
              <h3>{f.title}</h3>
              <p>{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="l2-block">
        <h2>Live in three steps</h2>
        <ol className="l2-steps">
          {STEPS.map(([t, p], i) => <li key={t}><b>{String(i + 1).padStart(2, "0")}</b><h3>{t}</h3><p>{p}</p></li>)}
        </ol>
      </section>

      <section className="l2-block">
        <div className="l2-price">
          <div>
            <span className="l2-pill"><i />One simple plan</span>
            <h2>$0 for 7 days.<br />Then $39 a month.</h2>
            <p>Every feature from day one. Cancel anytime before day 7 and pay nothing.</p>
          </div>
          <div className="l2-ctas col">
            <a className="l2-btn" href="/signup">Start for Free</a>
            <a className="l2-btn ghost" href="/m/demo" target="_blank" rel="noreferrer">Menu example →</a>
          </div>
        </div>
      </section>

      <footer className="l2-foot">
        <span>© 2026 MNU Digital</span>
        <nav><a href="/terms">Terms</a><a href="/privacy">Privacy</a><a href="/accessibility">Accessibility</a></nav>
      </footer>
    </div>
  );
}
