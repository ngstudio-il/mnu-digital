"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useDash } from "./VenueContext";
import { LANGUAGES, MAX_TRANSLATIONS, language } from "@/lib/languages";
import { syncTranslations } from "@/lib/translate-client";
import type { Venue } from "@/lib/types";

export default function MenuLanguages() {
  const { venue, setVenue, toast } = useDash();
  const primary = venue.primary_lang || "en";
  const targets = venue.langs.filter((l) => l !== primary);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<{ busy: boolean; remaining: number; error?: string }>({ busy: false, remaining: 0 });

  const matches = useMemo(() => {
    const s = q.trim().toLowerCase();
    if (!s) return [];
    return LANGUAGES.filter((l) => l.code !== primary && !targets.includes(l.code) && (l.name.toLowerCase().includes(s) || l.native.toLowerCase().includes(s) || l.code.toLowerCase() === s)).slice(0, 8);
  }, [q, primary, targets]);

  function run() {
    setStatus((s) => ({ ...s, busy: true, error: undefined }));
    syncTranslations((p) => setStatus({ busy: !p.done, remaining: p.remaining, error: p.error }));
  }
  useEffect(() => { if (targets.length) run(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(p: Partial<Venue>, msg: string) {
    const { data, error } = await supabaseBrowser().from("venues").update(p).eq("id", venue.id).select().single();
    if (error || !data) return toast(error?.message.includes("primary_lang") ? "Languages need a database update first (0009_translations.sql)." : "Couldn’t save. Check your connection.");
    setVenue(data);
    toast(msg);
    if ((data.langs as string[]).some((l) => l !== data.primary_lang)) run();
  }

  const setPrimary = (code: string) => save({ primary_lang: code, langs: [code, ...targets.filter((l) => l !== code)] }, `Main language: ${language(code).name}`);
  function addTarget(code: string) {
    setQ("");
    if (targets.length >= MAX_TRANSLATIONS) return toast(`Up to ${MAX_TRANSLATIONS} translations per menu`);
    save({ langs: [primary, ...targets, code] }, `Translating into ${language(code).name}…`);
  }
  const removeTarget = (code: string) => save({ langs: [primary, ...targets.filter((l) => l !== code)] }, `${language(code).name} removed`);

  return (
    <div className="card">
      <h3>Menu languages</h3>
      <label className="field" htmlFor="m-lang">Main language
        <select id="m-lang" value={primary} onChange={(e) => setPrimary(e.target.value)}>
          {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.native === l.name ? l.name : `${l.name} · ${l.native}`}</option>)}
        </select>
        <small>The language you write your dishes in. Buttons on your menu, like “Add to order”, appear in it too.</small>
      </label>

      <div>
        <p className="fieldset-label">Translate automatically into</p>
        {targets.length > 0 && (
          <div className="lang-chips">{targets.map((c) => (
            <span key={c}>{language(c).name}<button type="button" onClick={() => removeTarget(c)} aria-label={`Remove ${language(c).name}`}>×</button></span>
          ))}</div>
        )}
        <div className="lang-search">
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Add a language: Spanish, 日本語, Français…" aria-label="Add a language"
            onKeyDown={(e) => { if (e.key === "Enter" && matches[0]) { e.preventDefault(); addTarget(matches[0].code); } }} />
          {matches.length > 0 && (
            <ul>{matches.map((l) => <li key={l.code}><button type="button" onClick={() => addTarget(l.code)}>{l.name}<span>{l.native}</span></button></li>)}</ul>
          )}
          {q.trim() && !matches.length && <p className="note">No language found.</p>}
        </div>
      </div>

      <div className="set-row">
        <div>
          <b>{!targets.length ? "No translations yet" : status.busy ? `Translating… ${status.remaining ? `${status.remaining} left` : ""}` : status.error ? "Translation paused" : "Translations up to date"}</b>
          <span>{status.error ?? (targets.length ? "New and edited dishes are translated by AI within a few seconds, using your AI text credits (1 per 10 items, per language). Guests get their phone’s language when you offer it, and can switch with the language button." : "Add languages and your whole menu is translated by AI.")}</span>
        </div>
        {targets.length > 0 && <button className="btn ghost sm" type="button" onClick={run} disabled={status.busy}>{status.busy ? "Working…" : "Translate now"}</button>}
      </div>
    </div>
  );
}
