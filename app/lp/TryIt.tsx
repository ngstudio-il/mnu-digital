"use client";
import "@/styles/lp.css";
import { useEffect, useRef, useState } from "react";
import { shrink } from "@/lib/shrink";
import { LP_PDF_MAX, PDF_DIRECT_MAX } from "@/lib/lp-limits";
import { supabaseBrowser } from "@/lib/supabase/client";
import QRCode from "qrcode";
import { LP_LANGS, LP_STRINGS, MENU_LANGS, type LpLang } from "./strings";

type Step = "pick" | "reading" | "done";

// The simplest possible start: drop or paste your menu, see it as a digital menu, then sign up
// to edit it and get your QR code. The menu is kept and added to the account after sign-up.
async function uploadPdf(file: File) {
  const res = await fetch("/api/lp/upload", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ size: file.size, type: file.type }) });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(json.error ?? "");
  const { error } = await supabaseBrowser().storage.from("dish-photos").uploadToSignedUrl(json.path, json.token, file, { contentType: "application/pdf" });
  if (error) throw new Error("");
  return json.path as string;
}

export default function TryIt() {
  const [ui, setUi] = useState<LpLang>("en");
  const [langOpen, setLangOpen] = useState(false);
  const t = LP_STRINGS[ui];
  const rtl = LP_LANGS.find((l) => l.code === ui && "rtl" in l) !== undefined;

  const [step, setStep] = useState<Step>("pick");
  const [mode, setMode] = useState<"file" | "text">("file");
  const [text, setText] = useState("");
  const [drag, setDrag] = useState(false);
  const [err, setErr] = useState("");
  const [draft, setDraft] = useState<{ id: string; dishes: number } | null>(null);
  const [name, setName] = useState("");
  const [previewName, setPreviewName] = useState("");
  const [langs, setLangs] = useState<string[]>([]);
  const [busyLang, setBusyLang] = useState("");
  const [showLang, setShowLang] = useState<string | null>(null);
  const [tErr, setTErr] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const [qr, setQr] = useState("");
  const [cover, setCover] = useState(false);
  useEffect(() => { QRCode.toDataURL("https://www.mnu.digital", { margin: 0, width: 120, color: { dark: "#1f2829", light: "#ffffff" } }).then(setQr).catch(() => {}); }, []);

  // Sign-up lives on the main site (www), also when this page is opened on lp.mnu.digital.
  const [main, setMain] = useState("");
  useEffect(() => {
    setMain(window.location.origin.replace("//lp.", "//www."));
    let pick: string | null = null;
    try { pick = localStorage.getItem("mnu.lp.lang"); } catch { /* storage unavailable */ }
    const browser = (navigator.language || "en").slice(0, 2);
    const found = LP_LANGS.find((l) => l.code === (pick || browser));
    if (found) setUi(found.code);
  }, []);
  useEffect(() => { document.documentElement.lang = ui; document.documentElement.dir = rtl ? "rtl" : "ltr"; }, [ui, rtl]);
  function chooseUi(code: LpLang) {
    setUi(code); setLangOpen(false);
    try { localStorage.setItem("mnu.lp.lang", code); } catch { /* storage unavailable */ }
  }
  const startUrl = (withDraft: boolean) => `${main}/start?${new URLSearchParams({ ...(withDraft && draft ? { draft: draft.id } : {}), ...(name.trim() ? { name: name.trim() } : {}) })}`;

  async function send(files: File[] | null) {
    setErr("");
    const fd = new FormData();
    if (files) {
      const ok = files.filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
      if (!ok.length) return setErr(t.errType);
      const pdf = ok.find((f) => f.type === "application/pdf");
      if (pdf && pdf.size > LP_PDF_MAX) return setErr(t.errPdf);
      if (pdf && pdf.size > PDF_DIRECT_MAX) {
        // Too big to post to our server, so it goes straight to storage first.
        setStep("reading");
        const path = await uploadPdf(pdf).catch((e: Error) => { setStep("pick"); setErr(e.message || t.errGeneric); return null; });
        if (!path) return;
        fd.append("pdf", path);
      } else for (const f of pdf ? [pdf] : ok.slice(0, 6)) fd.append("files", await shrink(f));
    } else {
      if (text.trim().length < 10) return setErr(t.errPaste);
      fd.append("text", text);
    }
    setStep("reading");
    const res = await fetch("/api/lp/import", { method: "POST", body: fd }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res?.ok) { setStep("pick"); return setErr(json.error ?? t.errGeneric); }
    setDraft({ id: json.draft, dishes: (json.sections as { dishes: unknown[] }[]).reduce((n, s) => n + s.dishes.length, 0) });
    setLangs([]); setShowLang(null); setTErr(""); setCover(false);
    setStep("done");
    // A photo of one of their dishes for the menu's cover; the preview reloads once it's ready.
    const id = json.draft as string;
    fetch("/api/lp/cover", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft: id }) })
      .then((r) => r.json()).then((j) => { if (j?.cover) setDraft((d) => { if (d?.id === id) setCover(true); return d; }); }).catch(() => {});
  }

  async function translate(code: string) {
    if (!draft || busyLang) return;
    if (langs.includes(code)) return setShowLang(code);
    setBusyLang(code); setTErr("");
    const res = await fetch("/api/lp/translate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ draft: draft.id, lang: code }) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setBusyLang("");
    if (!res?.ok) return setTErr(json.error ?? t.errGeneric);
    setLangs(json.langs ?? [...langs, code]);
    setShowLang(code);
  }

  const previewSrc = draft ? `/lp/preview?${new URLSearchParams({ draft: draft.id, ...(previewName.trim() ? { name: previewName.trim() } : {}), ...(showLang ? { lang: showLang } : {}), v: `${langs.length}${cover ? "c" : ""}` })}` : "";

  return (
    <div className="lp" dir={rtl ? "rtl" : "ltr"}>
      <header className="lp-head">
        <a href={main || "/"} className="lp-logo"><img src="/assets/mnu-logo.png" alt="mnu.digital" /></a>
        <div className="lp-head-actions">
          <div className="lp-lang">
            <button type="button" className="lp-lang-btn" onClick={() => setLangOpen((v) => !v)} aria-expanded={langOpen} aria-label={t.language}>
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3z" /></svg>
              <span>{LP_LANGS.find((l) => l.code === ui)?.label}</span>
            </button>
            {langOpen && (
              <ul className="lp-lang-menu" role="listbox">
                {LP_LANGS.map((l) => <li key={l.code}><button type="button" role="option" aria-selected={l.code === ui} onClick={() => chooseUi(l.code)} dir={"rtl" in l ? "rtl" : "ltr"}>{l.label}</button></li>)}
              </ul>
            )}
          </div>
          <a href={`${main}/login`} className="lp-login">{t.login}</a>
        </div>
      </header>

      {step !== "done" ? (
        <main className="lp-start">
          <h1>{t.h1a}<br />{t.h1b}</h1>
          <p className="lp-sub">{t.sub}</p>

          <div className="lp-card">
            <div className="lp-tabs" role="tablist">
              <button role="tab" type="button" aria-selected={mode === "file"} onClick={() => setMode("file")} disabled={step === "reading"}>{t.tabFile}</button>
              <button role="tab" type="button" aria-selected={mode === "text"} onClick={() => setMode("text")} disabled={step === "reading"}>{t.tabText}</button>
            </div>
            {step === "reading" ? (
              <div className="lp-reading"><i /><b>{t.reading}</b><span>{t.readingSub}</span></div>
            ) : mode === "file" ? (
              <div className={`lp-drop${drag ? " over" : ""}`} role="button" tabIndex={0}
                onClick={() => input.current?.click()}
                onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") input.current?.click(); }}
                onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
                onDrop={(e) => { e.preventDefault(); setDrag(false); send(Array.from(e.dataTransfer.files)); }}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
                <b>{t.drop}</b>
                <span>{t.dropOr} <u>{t.choose}</u> · {t.dropTypes}</span>
                <input ref={input} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => { const f = e.target.files; if (f?.length) send(Array.from(f)); e.target.value = ""; }} />
              </div>
            ) : (
              <div className="lp-paste">
                <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={"Starters\nSourdough & dips – warm bread, tahini, salsa  $12\nGoat cheese salad – frisée, walnuts  $16"} aria-label={t.tabText} dir="auto" />
                <button className="lp-btn" type="button" onClick={() => send(null)}>{t.pasteBtn}</button>
              </div>
            )}
            {err && <p className="lp-err" role="alert">{err}</p>}
            <div className="lp-qr lp-qr-card" aria-hidden="true">{qr && <img src={qr} alt="" />}<small>Scan me</small></div>
          </div>
          <a className="lp-empty" href={startUrl(false)}>{t.empty}</a>
        </main>
      ) : (
        <main className="lp-result">
          <div className="lp-copy">
            <span className="lp-pill">✓ {t.found.replace("{n}", String(draft?.dishes ?? 0))}</span>
            <h1>{t.r1}<br /><span className="lp-grad">{t.r2}</span></h1>
            <p className="lp-sub">{t.rsub}</p>

            <div className="lp-translate">
              <div className="lp-translate-head"><b>✦ {t.tTitle}</b><span>{t.tSub}</span></div>
              <div className="lp-chips">
                {MENU_LANGS.map(([code, label]) => {
                  const done = langs.includes(code), busy = busyLang === code;
                  const full = langs.length >= 3 && !done;
                  return (
                    <button key={code} type="button" className={`${done ? "done" : ""}${showLang === code ? " on" : ""}`} disabled={full || (!!busyLang && !busy)} onClick={() => translate(code)} aria-pressed={showLang === code}>
                      {busy ? t.translating : done ? `✓ ${label}` : label}
                    </button>
                  );
                })}
              </div>
              {tErr && <p className="lp-err">{tErr}</p>}
            </div>

            <label className="lp-field">{t.name}
              <input value={name} onChange={(e) => setName(e.target.value)} onBlur={() => setPreviewName(name)} onKeyDown={(e) => { if (e.key === "Enter") setPreviewName(name); }} placeholder={t.namePh} dir="auto" />
            </label>
            <a className="lp-btn big" href={startUrl(true)}>{t.cta}</a>
            <p className="lp-note">{t.saved}</p>
            <button type="button" className="lp-again" onClick={() => { setStep("pick"); setDraft(null); }}>{t.again}</button>
          </div>
          <div className="lp-stage">
            <div className="lp-glow" aria-hidden="true" />
            <div className="lp-phone"><iframe key={previewSrc} src={previewSrc} title="Your digital menu" /></div>
            <div className="lp-qr" aria-hidden="true">{qr && <img src={qr} alt="" />}<small>Scan me</small></div>
          </div>
        </main>
      )}
    </div>
  );
}
