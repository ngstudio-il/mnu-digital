"use client";
import { useEffect } from "react";

// Google Ads "sign-up" conversion. /onboarding sends a brand-new account on with ?signup=1;
// this reports it once and takes the flag out of the address so a reload doesn't count twice.
export default function SignupConversion() {
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get("signup") !== "1") return;
    const w = window as Window & { gtag?: (...a: unknown[]) => void };
    try { w.gtag?.("event", "conversion", { send_to: "AW-18530337238/T95PCNqwp6gdENaD-oNF", value: 1.0, currency: "ILS" }); } catch { /* tracker blocked */ }
    url.searchParams.delete("signup");
    window.history.replaceState(window.history.state, "", url.pathname + url.search + url.hash);
  }, []);
  return null;
}
