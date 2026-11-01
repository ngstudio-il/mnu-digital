"use client";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import BillingDetailsForm, { billingValid } from "./BillingDetailsForm";
import { countryFromZone, guessCountry, type BillingDetails } from "@/lib/countries";

// Settings → General: the details printed on invoices.
// support: an admin is viewing; nothing is guessed from the admin's own browser.
export default function BillingDetailsCard({ venueId, venueName, timezone, support, toast }: { venueId: string; venueName: string; timezone: string | null; support: boolean; toast: (m: string) => void }) {
  const [v, setV] = useState<BillingDetails | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    supabaseBrowser().from("billing_profiles").select("country, name, tax_id, address").eq("venue_id", venueId).maybeSingle()
      .then(({ data }: { data: { country: string; name: string; tax_id: string | null; address: string | null } | null }) =>
        setV(data ? { country: data.country, name: data.name, tax_id: data.tax_id ?? "", address: data.address ?? "" } : { country: countryFromZone(timezone) || (support ? "" : guessCountry()), name: venueName, tax_id: "", address: "" }));
  }, [venueId, venueName, timezone, support]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!v || !billingValid(v)) return toast("Add your country and the name for your invoices.");
    setBusy(true);
    const res = await fetch("/api/billing/details", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(v) }).catch(() => null);
    const json = res ? await res.json().catch(() => ({})) : {};
    setBusy(false);
    toast(res?.ok ? "Billing details saved" : json.error ?? "Couldn’t save. Try again.");
  }

  return (
    <form className="card" onSubmit={save}>
      <h3>Billing details</h3>
      <p className="note" style={{ marginTop: -4 }}>Shown on your invoices.</p>
      {v ? <BillingDetailsForm value={v} onChange={setV} idPrefix="set-bd" /> : <p className="note">Loading…</p>}
      <div><button className="btn" type="submit" disabled={busy || !v}>{busy ? "Saving…" : "Save billing details"}</button></div>
    </form>
  );
}
