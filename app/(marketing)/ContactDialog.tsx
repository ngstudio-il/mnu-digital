"use client";
import { useEffect, useRef, useState } from "react";
import { CONTACT_TOPICS } from "@/lib/contact";

// "Contact" anywhere on the home page (links to #contact) opens this form instead of scrolling.
export default function ContactDialog() {
  const [open, setOpen] = useState(false);
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [err, setErr] = useState("");
  const first = useRef<HTMLInputElement>(null);
  const opener = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest?.('a[href="#contact"]') as HTMLElement | null;
      if (!a || e.metaKey || e.ctrlKey) return;
      e.preventDefault();
      opener.current = a;
      setState("idle"); setErr(""); setOpen(true);
    };
    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => first.current?.focus(), 50);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") close(); };
    document.addEventListener("keydown", esc);
    return () => { document.body.style.overflow = prev; document.removeEventListener("keydown", esc); };
  }, [open]);

  function close() { setOpen(false); opener.current?.focus(); }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.currentTarget).entries());
    setState("sending"); setErr("");
    const res = await fetch("/api/contact", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { setState("idle"); setErr(json.error ?? "Couldn’t send your message. Try again."); return; }
    setState("sent");
  }

  if (!open) return null;
  return (
    <div className="cf-overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className="cf" role="dialog" aria-modal="true" aria-labelledby="cf-title">
        <button className="cf-x" type="button" onClick={close} aria-label="Close">×</button>
        {state === "sent" ? (
          <div className="cf-done">
            <span className="cf-check" aria-hidden="true">✓</span>
            <h3 id="cf-title">Thanks, we got it</h3>
            <p>We’ll get back to you by email, usually within one business day.</p>
            <button className="btn" type="button" onClick={close}>Close</button>
          </div>
        ) : (
          <form onSubmit={submit} noValidate>
            <h3 id="cf-title">Contact us</h3>
            <p className="cf-sub">Questions, a demo, or help with your menu. Leave your details and we’ll get back to you.</p>
            <label className="cf-field">Topic
              <select name="topic" defaultValue={CONTACT_TOPICS[0]}>{CONTACT_TOPICS.map((t) => <option key={t}>{t}</option>)}</select>
            </label>
            <div className="cf-row">
              <label className="cf-field">Name<input ref={first} name="name" required autoComplete="name" maxLength={120} /></label>
              <label className="cf-field">Email<input name="email" type="email" required autoComplete="email" maxLength={200} /></label>
            </div>
            <div className="cf-row">
              <label className="cf-field"><span>Phone <small>optional</small></span><input name="phone" type="tel" autoComplete="tel" maxLength={40} /></label>
              <label className="cf-field"><span>Business <small>optional</small></span><input name="business" autoComplete="organization" maxLength={160} /></label>
            </div>
            <label className="cf-field">Message<textarea name="message" required rows={4} maxLength={5000} /></label>
            <input className="cf-hp" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" />
            {err && <p className="cf-err" role="alert">{err}</p>}
            <button className="btn cf-send" type="submit" disabled={state === "sending"}>{state === "sending" ? "Sending…" : "Send message"}</button>
          </form>
        )}
      </div>
    </div>
  );
}
