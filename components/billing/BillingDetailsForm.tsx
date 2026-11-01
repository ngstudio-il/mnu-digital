"use client";
import { useMemo, useState } from "react";
import { COUNTRIES, type BillingDetails } from "@/lib/countries";

// Country, name on the invoice, tax ID and address. Used on the billing page and in Settings.
// compact: only the country shows, with the rest one tap away (opened by the page when the name is missing).
export default function BillingDetailsForm({ value, onChange, idPrefix = "bd", compact = false, open: forceOpen = false }: { value: BillingDetails; onChange: (v: BillingDetails) => void; idPrefix?: string; compact?: boolean; open?: boolean }) {
  const countries = useMemo(() => COUNTRIES(), []);
  const [opened, setOpened] = useState(false);
  const expanded = !compact || opened || forceOpen;
  const set = (k: keyof BillingDetails) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="bd-form">
      <div className={expanded ? "row2" : undefined}>
        <label className="field" htmlFor={`${idPrefix}-country`}>Country
          <select id={`${idPrefix}-country`} value={value.country} onChange={set("country")} required>
            <option value="" disabled>Choose a country</option>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </label>
        {expanded && <label className="field" htmlFor={`${idPrefix}-name`}>Name on invoice
          <input id={`${idPrefix}-name`} value={value.name} onChange={set("name")} maxLength={160} required autoComplete="organization" />
        </label>}
      </div>
      {!expanded && (
        <button type="button" className="bd-more" onClick={() => setOpened(true)}>
          {value.name.trim() ? <>Invoice to <b>{value.name}</b> · <u>Edit or add tax ID</u></> : <u>+ Add the name, tax ID or address for your invoices</u>}
        </button>
      )}
      {expanded && <div className="row2">
        <label className="field" htmlFor={`${idPrefix}-tax`}><span>Tax ID / VAT number <small>optional</small></span>
          <input id={`${idPrefix}-tax`} value={value.tax_id} onChange={set("tax_id")} maxLength={40} />
        </label>
        <label className="field" htmlFor={`${idPrefix}-addr`}><span>Address <small>optional</small></span>
          <input id={`${idPrefix}-addr`} value={value.address} onChange={set("address")} maxLength={300} autoComplete="street-address" />
        </label>
      </div>}
    </div>
  );
}

export const billingValid = (v: BillingDetails) => !!v.country && v.name.trim().length > 1;
