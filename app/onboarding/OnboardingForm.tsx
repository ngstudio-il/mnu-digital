"use client";
import "@/styles/app.css";
import "@/styles/auth.css";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { slugify } from "@/lib/format";

const TYPES = ["Restaurant", "Café", "Bar", "Hotel", "Other"];
const STARTER_CATEGORIES = ["Starters", "Mains", "Desserts", "Drinks"];

export default function OnboardingForm({ defaultName, ownerName }: { defaultName: string; ownerName: string }) {
  const router = useRouter();
  const [name, setName] = useState(defaultName);
  const [type, setType] = useState("Restaurant");
  const [currency, setCurrency] = useState("$");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return setErr("Enter your venue name.");
    setBusy(true); setErr("");
    const sb = supabaseBrowser();
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return router.push("/login");
    let slug = slugify(name);
    let venue = null;
    for (let i = 0; i < 4 && !venue; i++) {
      const { data, error } = await sb.from("venues").insert({ owner_id: user.id, name: name.trim(), slug, type, currency }).select().single();
      if (data) venue = data;
      else if (error?.code === "23505") slug = `${slugify(name)}-${Math.random().toString(36).slice(2, 6)}`;
      else { setErr(error?.message ?? "Something went wrong. Try again."); setBusy(false); return; }
    }
    if (!venue) { setErr("Couldn’t create a link for this venue. Try a different name."); setBusy(false); return; }
    await sb.from("categories").insert(STARTER_CATEGORIES.map((n, i) => ({ venue_id: venue.id, name: n, position: i })));
    router.push("/dashboard");
    router.refresh();
  }

  return (
    <div className="auth">
      <section className="auth-form">
        <div className="auth-top"><a className="logo" href="/"><img src="/assets/mnu-logo.png" alt="mnu.digital" /></a></div>
        <div className="auth-box">
          <h1>{ownerName ? `Welcome, ${ownerName.split(" ")[0]}` : "Welcome"}</h1>
          <p className="sub">Tell us about your venue. You can change this later.</p>
          <form onSubmit={submit} noValidate style={{ marginTop: 28 }}>
            <label className="field" htmlFor="v-name">Venue name<input id="v-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Olive & Salt" /></label>
            <div className="row2">
              <label className="field" htmlFor="v-type">Type<select id="v-type" value={type} onChange={(e) => setType(e.target.value)}>{TYPES.map((t) => <option key={t}>{t}</option>)}</select></label>
              <label className="field" htmlFor="v-cur">Currency<select id="v-cur" value={currency} onChange={(e) => setCurrency(e.target.value)}>
                <option value="$">US dollar ($)</option><option value="₪">Israeli shekel (₪)</option><option value="€">Euro (€)</option><option value="£">Pound (£)</option>
              </select></label>
            </div>
            <p className="note" style={{ fontSize: 13, color: "var(--dim)" }}>Your menu link: mnu.digital/m/{slugify(name || "your-venue")}</p>
            <p className="err" aria-live="polite">{err}</p>
            <button className="btn block" type="submit" disabled={busy}>{busy ? "Setting up…" : "Create my menu"}</button>
          </form>
        </div>
      </section>
      <aside className="auth-side" aria-hidden="true">
        <h2>Three steps to a live menu.</h2>
        <ul className="perks"><li>Add your dishes and photos</li><li>Pick your brand colour</li><li>Print your QR codes</li></ul>
      </aside>
    </div>
  );
}
