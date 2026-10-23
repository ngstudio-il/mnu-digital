"use client";
import { useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useDash } from "./VenueContext";
import type { Category } from "@/lib/types";
import { shrink } from "@/lib/shrink";

type Row = { key: string; keep: boolean; name: string; description: string; price: string };
type Section = { name: string; rows: Row[] };

export default function ImportMenu({ cats, onClose, onDone }: { cats: Category[]; onClose: () => void; onDone: () => void }) {
  const { venue, toast } = useDash();
  const [files, setFiles] = useState<File[]>([]);
  const [step, setStep] = useState<"pick" | "reading" | "review" | "saving">("pick");
  const [sections, setSections] = useState<Section[]>([]);
  const [err, setErr] = useState("");
  const [left, setLeft] = useState<string>("");
  const [drag, setDrag] = useState(false);
  const [mode, setMode] = useState<"file" | "text">("file");
  const [text, setText] = useState("");
  const input = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape" && step !== "reading" && step !== "saving") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose, step]);

  function pick(list: FileList | null) {
    if (!list) return;
    const chosen = Array.from(list).filter((f) => f.type.startsWith("image/") || f.type === "application/pdf");
    if (!chosen.length) return setErr("Choose photos (JPG, PNG) or a PDF.");
    const pdf = chosen.find((f) => f.type === "application/pdf");
    if (pdf && pdf.size > 4 * 1024 * 1024) return setErr("That PDF is over 4 MB. Export a smaller one or upload photos instead.");
    setErr("");
    setFiles(pdf ? [pdf] : chosen.slice(0, 6));
  }

  async function read() {
    setStep("reading"); setErr("");
    const fd = new FormData();
    if (mode === "text") fd.append("text", text);
    else for (const f of files) fd.append("files", await shrink(f));
    const res = await fetch("/api/ai/import", { method: "POST", body: fd }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    if (!res || !res.ok) { setErr(json.error ?? "Couldn’t read the menu. Try again."); setStep("pick"); return; }
    let n = 0;
    setSections((json.sections as { name: string; dishes: { name: string; description: string; price: number | null }[] }[]).map((s) => ({
      name: s.name,
      rows: s.dishes.map((d) => ({ key: String(n++), keep: true, name: d.name, description: d.description, price: d.price === null ? "" : String(d.price) })),
    })));
    if (json.quota !== null && json.used !== null) setLeft(`${json.quota - json.used} of ${json.quota} imports left this month`);
    setStep("review");
  }

  const edit = (si: number, key: string, patch: Partial<Row>) =>
    setSections((ss) => ss.map((s, i) => (i !== si ? s : { ...s, rows: s.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) })));
  const count = sections.reduce((t, s) => t + s.rows.filter((r) => r.keep && r.name.trim()).length, 0);

  async function save() {
    setStep("saving");
    const sb = supabaseBrowser();
    const known = new Map(cats.map((c) => [c.name.trim().toLowerCase(), c.id]));
    let position = cats.length;
    const rows: Record<string, unknown>[] = [];
    for (const s of sections) {
      const keep = s.rows.filter((r) => r.keep && r.name.trim());
      if (!keep.length) continue;
      let catId = known.get(s.name.trim().toLowerCase());
      if (!catId) {
        const { data, error } = await sb.from("categories").insert({ venue_id: venue.id, name: s.name.trim(), position: position++ }).select().single();
        if (error || !data) { setErr("Couldn’t create the section " + s.name); setStep("review"); return; }
        catId = data.id as string;
        known.set(s.name.trim().toLowerCase(), catId);
      }
      keep.forEach((r, i) => rows.push({ venue_id: venue.id, category_id: catId, name: r.name.trim(), description: r.description.trim(), price: Math.max(0, parseFloat(r.price) || 0), available: true, position: i }));
    }
    const { error } = await sb.from("dishes").insert(rows);
    if (error) { setErr("Couldn’t save the dishes: " + error.message); setStep("review"); return; }
    toast(`${rows.length} dishes added to your menu`);
    onDone();
  }

  const busy = step === "reading" || step === "saving";
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget && !busy) onClose(); }}>
      <div className="modal import-modal" role="dialog" aria-modal="true" aria-labelledby="imp-title">
        <div className="modal-head">
          <h3 id="imp-title">{step === "review" || step === "saving" ? `Review ${count} dishes` : "Import your menu"}</h3>
          <button className="x" type="button" onClick={onClose} aria-label="Close" disabled={busy}>×</button>
        </div>

        {(step === "pick" || step === "reading") && (
          <>
            <div className="seg imp-tabs" role="group" aria-label="Import from">
              <button type="button" aria-pressed={mode === "file"} onClick={() => setMode("file")} disabled={busy}>Photo or PDF</button>
              <button type="button" aria-pressed={mode === "text"} onClick={() => setMode("text")} disabled={busy}>Paste text</button>
            </div>
            <p className="note">{mode === "file"
              ? "Upload photos of your printed menu, screenshots from a delivery app, or a PDF. AI reads the sections, dishes, descriptions and prices, and you check everything before it’s added."
              : "Copy your menu from your website, a delivery app page or a document, and paste it here. Extra page text like ratings or buttons is ignored."}</p>
            {mode === "text" ? (
              <textarea className="imp-text" value={text} onChange={(e) => setText(e.target.value)} disabled={busy} placeholder={"Starters\nSourdough & dips – warm sourdough, tahini, tomato salsa  $12\nGoat cheese salad – frisée, walnuts, balsamic  $16\n…"} aria-label="Menu text" />
            ) : (
            <div
              className={`drop${drag ? " over" : ""}`}
              onClick={() => !busy && input.current?.click()}
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); if (!busy) pick(e.dataTransfer.files); }}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") input.current?.click(); }}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 16V4M7 9l5-5 5 5M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></svg>
              {files.length ? <b>{files.map((f) => f.name).join(", ")}</b> : <b>Drop menu photos or a PDF here</b>}
              <span>{files.length ? "Click to choose different files" : "or click to choose · up to 6 photos or one PDF (4 MB)"}</span>
              <input ref={input} type="file" accept="image/*,application/pdf" multiple hidden onChange={(e) => pick(e.target.files)} />
            </div>
            )}
            {step === "reading" && <div className="reading"><i /><span>Reading your menu… this takes up to a minute.</span></div>}
            {err && <p className="note" style={{ color: "var(--coral)" }}>{err}</p>}
            <div className="modal-foot"><span /><div style={{ display: "flex", gap: 8 }}>
              <button className="btn ghost" type="button" onClick={onClose} disabled={busy}>Cancel</button>
              <button className="btn" type="button" onClick={read} disabled={(mode === "file" ? !files.length : text.trim().length < 10) || busy}>{step === "reading" ? "Reading…" : "Read menu"}</button>
            </div></div>
          </>
        )}

        {(step === "review" || step === "saving") && (
          <>
            <p className="note">Untick anything you don’t want, and fix names or prices before adding. {left}</p>
            <div className="imp-list">
              {sections.map((s, si) => (
                <section key={si}>
                  <input className="imp-sec" value={s.name} aria-label="Section name" onChange={(e) => setSections((ss) => ss.map((x, i) => (i === si ? { ...x, name: e.target.value } : x)))} />
                  {s.rows.map((r) => (
                    <div className={`imp-row${r.keep ? "" : " off"}`} key={r.key}>
                      <input type="checkbox" checked={r.keep} onChange={(e) => edit(si, r.key, { keep: e.target.checked })} aria-label={`Include ${r.name}`} />
                      <div className="imp-main">
                        <input value={r.name} onChange={(e) => edit(si, r.key, { name: e.target.value })} aria-label="Dish name" />
                        {r.description && <small>{r.description}</small>}
                      </div>
                      <label className="imp-price"><span>{venue.currency}</span><input value={r.price} inputMode="decimal" placeholder="–" onChange={(e) => edit(si, r.key, { price: e.target.value })} aria-label={`Price of ${r.name}`} /></label>
                    </div>
                  ))}
                </section>
              ))}
            </div>
            {err && <p className="note" style={{ color: "var(--coral)" }}>{err}</p>}
            <div className="modal-foot">
              <button className="btn ghost" type="button" onClick={() => { setStep("pick"); setSections([]); }} disabled={busy}>Start over</button>
              <button className="btn" type="button" onClick={save} disabled={!count || busy}>{step === "saving" ? "Adding…" : `Add ${count} dishes`}</button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
