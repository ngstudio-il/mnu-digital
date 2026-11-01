"use client";
import { useMemo } from "react";
import { COUNTRIES, type BillingDetails } from "@/lib/countries";

// Country, name on the invoice, tax ID and address. Used on the billing page and in Settings.
export default function BillingDetailsForm({ value, onChange, idPrefix = "bd" }: { value: BillingDetails; onChange: (v: BillingDetails) => void; idPrefix?: string }) {
  const countries = useMemo(() => COUNTRIES(), []);
  const set = (k: keyof BillingDetails) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => onChange({ ...value, [k]: e.target.value });
  return (
    <div className="bd-form">
      <div className="row2">
        <label className="field" htmlFor={`${idPrefix}-country`}>Country
          <select id={`${idPrefix}-country`} value={value.country} onChange={set("country")} required>
            <option value="" disabled>Choose a country</option>
            {countries.map((c) => <option key={c.code} value={c.code}>{c.name}</option>)}
          </select>
        </label>
        <label className="field" htmlFor={`${idPrefix}-name`}>Name on invoice
          <input id={`${idPrefix}-name`} value={value.name} onChange={set("name")} maxLength={160} required autoComplete="organization" />
        </label>
      </div>
      <div className="row2">
        <label className="field" htmlFor={`${idPrefix}-tax`}><span>Tax ID / VAT number <small>optional</small></span>
          <input id={`${idPrefix}-tax`} value={value.tax_id} onChange={set("tax_id")} maxLength={40} />
        </label>
        <label className="field" htmlFor={`${idPrefix}-addr`}><span>Address <small>optional</small></span>
          <input id={`${idPrefix}-addr`} value={value.address} onChange={set("address")} maxLength={300} autoComplete="street-address" />
        </label>
      </div>
    </div>
  );
}

export const billingValid = (v: BillingDetails) => !!v.country && v.name.trim().length > 1;
