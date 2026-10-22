"use client";
import "@/styles/app.css";
import "@/styles/auth.css";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import SetupNotice from "@/components/SetupNotice";

type Mode = "signup" | "login";

const COPY = {
  signup: { title: "Create your free account", sub: "Your digital menu will be ready in minutes.", google: "Sign up with Google", submit: "Create free account" },
  login: { title: "Welcome back", sub: "Log in to manage your menu and orders.", google: "Continue with Google", submit: "Log in" },
};

export default function AuthForm({ mode }: { mode: Mode }) {
  const router = useRouter();
  const c = COPY[mode];
  const [name, setName] = useState("");
  const [venue, setVenue] = useState("");
  const [email, setEmail] = useState("");
  const [pass, setPass] = useState("");
  const [err, setErr] = useState("");
  const [info, setInfo] = useState("");
  const [busy, setBusy] = useState(false);

  async function google() {
    setErr("");
    if (!isSupabaseConfigured) return setErr("Sign-in isn’t connected yet.");
    setBusy(true);
    const { error } = await supabaseBrowser().auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) { setErr(error.message); setBusy(false); }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setErr(""); setInfo("");
    if (mode === "signup" && !name.trim()) return setErr("Enter your name.");
    if (mode === "signup" && !venue.trim()) return setErr("Enter your venue name.");
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) return setErr("Enter a valid email address.");
    if (pass.length < 8) return setErr("Password needs at least 8 characters.");
    if (!isSupabaseConfigured) return setErr("Sign-in isn’t connected yet.");
    setBusy(true);
    const sb = supabaseBrowser();
    if (mode === "signup") {
      const { data, error } = await sb.auth.signUp({
        email: email.trim(),
        password: pass,
        options: { data: { full_name: name.trim(), venue_name: venue.trim() }, emailRedirectTo: `${window.location.origin}/auth/callback` },
      });
      setBusy(false);
      if (error) return setErr(error.message);
      if (!data.session) return setInfo(`We sent a confirmation link to ${email.trim()}. Open it to finish signing up.`);
      router.push("/onboarding");
    } else {
      const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password: pass });
      setBusy(false);
      if (error) return setErr(error.message === "Invalid login credentials" ? "That email and password don’t match." : error.message);
      router.push("/dashboard");
    }
    router.refresh();
  }

  return (
    <div className="auth" data-mode={mode}>
      <section className="auth-form">
        <div className="auth-top">
          <a className="logo" href="/"><img src="/assets/mnu-logo.png" alt="mnu.digital" /></a>
          <a className="back" href="/">← Back to site</a>
        </div>
        <div className="auth-box">
          <h1>{c.title}</h1>
          <p className="sub">{c.sub}</p>
          {!isSupabaseConfigured && <SetupNotice />}

          <button className="google" type="button" onClick={google} disabled={busy}>
            <svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
            <span>{c.google}</span>
          </button>

          <div className="or">or with email</div>

          <form onSubmit={submit} noValidate>
            {mode === "signup" && (
              <div className="row2">
                <label className="field" htmlFor="name">Your name<input id="name" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} /></label>
                <label className="field" htmlFor="venue">Venue name<input id="venue" autoComplete="organization" value={venue} onChange={(e) => setVenue(e.target.value)} /></label>
              </div>
            )}
            <label className="field" htmlFor="email">Email<input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></label>
            <label className="field" htmlFor="pass">Password {mode === "signup" && <small>At least 8 characters</small>}
              <input id="pass" type="password" autoComplete={mode === "login" ? "current-password" : "new-password"} value={pass} onChange={(e) => setPass(e.target.value)} />
            </label>
            <p className="err" aria-live="polite">{err}</p>
            {info && <p className="preview-note">{info}</p>}
            <button className="btn block" type="submit" disabled={busy}>{busy ? "One moment…" : c.submit}</button>
          </form>

          <p className="switch-mode">
            {mode === "signup" ? <>Already have an account? <Link href="/login">Log in</Link></> : <>New to mnu.digital? <Link href="/signup">Create an account</Link></>}
          </p>
          {mode === "signup" && <p className="legal">By signing up you agree to the Terms and Privacy Policy.</p>}
        </div>
      </section>

      <aside className="auth-side" aria-hidden="true">
        <h2>Your menu, live tonight.</h2>
        <ul className="perks">
          <li>7 days free, cancel anytime</li>
          <li>Menu, photos and prices in one place</li>
          <li>Take orders straight from the table</li>
        </ul>
        <div className="side-phone"><div className="scr">
          <div className="hd"><small>RESTAURANT · BAR</small><b>Olive &amp; Salt</b></div>
          {[["bread", "Sourdough & dips", "Tahini, tomato salsa", "$12"], ["salad", "Goat cheese salad", "Frisée, walnuts", "$16"], ["salmon", "Grilled salmon", "Lemon, dill", "$29"], ["espresso", "Espresso", "Double shot", "$4"]].map(([img, n, d, p]) => (
            <div className="it" key={n}><img src={`/assets/food/${img}-sq.jpg`} alt="" /><div><b>{n}</b><span>{d}</span></div><em>{p}</em></div>
          ))}
        </div></div>
      </aside>
    </div>
  );
}
