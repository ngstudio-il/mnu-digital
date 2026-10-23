"use client";
import "@/styles/lp.css";
import { useEffect, useRef, useState } from "react";
import { shrink } from "@/lib/shrink";

type Step = "pick" | "reading" | "done";

// The simplest possible start: drop or paste your menu, see it as a digital menu, then sign up
// to edit it and get your QR code. The menu is kept and added to the account after sign-up.
export default function TryIt() {
  const [step, setStep] = useState<Step>("pick");
  const [mode, setMode] = useState<"file" | "text">("file");
  const [text, setText] = useState("");
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState<{ id: string; dishes: number } | null>(null);
  const [name, setName] = useState("");
  const [previewName, setPreviewName] = useState("");
  const input = useRef<HTMLInputElement>(null);

  // Sign-up lives on the main site (www), also when this page is opened on lp.mnu.digital.
  const [main, setMain] = useState("");
  useEffect(() => { setMain(window.location.origin.replace("//lp.", "//www.")); }, []);
  const startUrl = (withDraft: boolean) => `${main}/start?${new URLSearchParams({ ...(withDraft && draft ? { draft: draft.id } : {}), ...(name.trim() ? { name: name.trim() } : {}) })}`;

  async function send(files: File[] | null) {
    setErr("");
    const fd = new FormData();
    if (files) {
      const ok = files.filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
      if (!ok.length) return setErr("Choose photos (JPG, PNG) or a PDF of your menu.");
      const pdf = ok.find((f) => f.type === "application/pdf");
      if (pdf && pdf.size > 4 * 1024 * 1024) return setErr("That PDF is over 4 MB. Try photos of the menu instead.");
      for (const f of pdf ? [pdf] : ok.slice(0, 6)) fd.append("files", await shrink(f));
    } else {
      if (text.trim().length < 10) return setErr("Paste your menu text first.");
      fd.append("text", text);
    }
    setStep("reading");
    const res = await fetch("/api/lp/import", { method: "POST", body: fd }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { setStep("pick"); return setErr(json.error ?? "Couldn’t read the menu. Try again."); }
    setDraft({ id: json.draft, dishes: (json.sections as { dishes: unknown[] }[]).reduce((t, s) => t + s.dishes.length, 0) });
    setStep("done");
  }

  return (
    <div className="lp">
      <header className="lp-head">
        <a href={main || "/"} className="lp-logo"><img src="/assets/mnu-logo.png" alt="mnu.digital" /></a>
        <a href={`${main}/login`} className="lp-login">Log in</a>
      </header>

      {step !== "done" ? (
        <main className="lp-start">
          <h1>See your menu as a<br />digital menu</h1>
          <p className="lp-sub">Drop a photo or PDF of your menu, or paste it. AI turns it into a digital QR menu in under a minute. Free, no sign-up.</p>

          <div className="lp-card">
            <div className="lp-tabs" role="tablist">
              <button role="tab" type="button" aria-selected={mode === "file"} onClick={() => setMode("file")} disabled={step === "reading"}>Photo or PDF</button>
              <button role="tab" type="button" aria-selected={mode === "text"} onClick={() => setMode("text")} disabled={step === "reading"}>Paste text</button>
            </div>
            {step === "reading" ? (
              <div className="lp-reading"><i /><b>Reading your menu…</b><span>This takes up to a minute.</span></div>
            ) : mode === "file" ? (
              <div className={`lp-drop${drag ? " over" : ""}`} role="button" tabIndex={0}
                onClick={() => input.current?.click()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") input.current?.click(); }}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); send(Array.from(e.dataTransfer.files)); }}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
                <b>Drag your menu here</b>
                <span>or <u>choose a file</u> · photos or a PDF</span>
                <input ref={input} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { const f = e.target.files; if (f?.length) send(Array.from(f)); e.target.value = ""; }} />
              </div>
            ) : (
              <div className="lp-paste">
                <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={"Starters\nSourdough & dips – warm bread, tahini, salsa  $12\nGoat cheese salad – frisée, walnuts  $16"} aria-label="Menu text" />
                <button className="lp-btn" type="button" onClick={() => send(null)}>Show my digital menu</button>
              </div>
            )}
            {err && <p className="lp-err" role="alert">{err}</p>}
          </div>
          <a className="lp-empty" href={startUrl(false)}>Or start with an empty menu →</a>
        </main>
      ) : (
        <main className="lp-result">
          <div className="lp-copy">
            <span className="lp-pill">✓ {draft?.dishes} dishes found</span>
            <h1>This is your<br />digital menu</h1>
            <p className="lp-sub">Guests open it by scanning a QR code. Sign up to edit it, add photos and your logo, take orders and print your QR codes.</p>
            <label className="lp-field">Restaurant name
              <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setPreviewName(name)} onKeyDown={(e) => { if (e.key === "Enter") setPreviewName(name); }} placeholder="e.g. Olive & Salt" />
            </label>
            <a className="lp-btn big" href={startUrl(true)}>Edit my menu &amp; get my QR code →</a>
            <p className="lp-note">Your menu is saved. It’s waiting in your account after you sign up.</p>
            <button type="button" className="lp-again" onClick={() => { setStep("pick"); setDraft(null); }}>Try a different menu</button>
          </div>
          <div className="lp-phone"><iframe src={`/lp/preview?${new URLSearchParams({ draft: draft!.id, ...(previewName.trim() ? { name: previewName.trim() } : {}) })}`} title="Your digital menu" /></div>
        </main>
      )}
    </div>
  );
}
