"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { LANGUAGES } from "@/lib/languages";

type User = { id: string; name: string; email: string; provider: string; lang: string };

// The owner's own profile: first name, the email they signed up with, and the dashboard language.
export default function ProfileDialog({ user, onClose, onSaved, onLogout, toast }: { user: User; onClose: () => void; onSaved: (u: User) => void; onLogout: () => void; toast: (m: string) => void }) {
  const [name, setName] = useState(user.name);
  const [lang, setLang] = useState(user.lang);
  const [busy, setBusy] = useState(false);
  const langs = useMemo(() => [...LANGUAGES].sort((a, b) => (a.code === "en" ? -1 : b.code === "en" ? 1 : a.name.localeCompare(b.name))), []);

  useEffect(() => {
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", esc);
    return () => document.removeEventListener("keydown", esc);
  }, [onClose]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return toast("Your name can’t be empty");
    setBusy(true);
    const { error } = await supabaseBrowser().auth.updateUser({ data: { first_name: name.trim(), ui_lang: lang } });
    setBusy(false);
    if (error) return toast("Couldn’t save your profile. Try again.");
    const changedLang = lang !== user.lang;
    onSaved({ ...user, name: name.trim(), lang });
    toast("Profile saved");
    // A new language reloads the dashboard so every page picks it up.
    if (changedLang) window.location.reload();
    else onClose();
  }

  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <form className="modal profile-modal" role="dialog" aria-modal="true" aria-labelledby="pf-title" onSubmit={save}>
        <div className="modal-head"><h3 id="pf-title">Your profile</h3><button className="x" type="button" onClick={onClose} aria-label="Close">×</button></div>
        <div className="pf-top"><span className="avatar lg" translate="no">{(name || user.email || "U").charAt(0).toUpperCase()}</span>
          <div><b translate="no">{name || user.email}</b><span translate="no">{user.email}</span></div></div>
        <label className="field" htmlFor="pf-name">First name<input id="pf-name" value={name} onChange={(e) => setName(e.target.value)} autoComplete="given-name" /></label>
        <label className="field" htmlFor="pf-email">Email<input id="pf-email" value={user.email} readOnly disabled />
          <small>{user.provider === "google" ? "You sign in with this Google account." : "You sign in with this email address."}</small></label>
        <label className="field" htmlFor="pf-lang">Dashboard language
          <select id="pf-lang" value={lang} onChange={(e) => setLang(e.target.value)} translate="no">
            {langs.map((l) => <option key={l.code} value={l.code}>{l.native === l.name ? l.name : `${l.native} · ${l.name}`}</option>)}
          </select>
          <small>The language of this dashboard. Your guests’ menu languages are set in Settings → Languages.</small></label>
        <div className="modal-foot">
          <button className="btn danger sm" type="button" onClick={onLogout}>Log out</button>
          <div style={{ display: "flex", gap: 8 }}>
            <button className="btn ghost" type="button" onClick={onClose}>Cancel</button>
            <button className="btn" type="submit" disabled={busy}>{busy ? "Saving…" : "Save"}</button>
          </div>
        </div>
      </form>
    </div>
  );
}
