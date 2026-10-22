"use client";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { VenueRow } from "@/lib/admin-data";
import { ago } from "@/lib/format";

const STATUS: [string, string][] = [["all", "All"], ["trialing", "Trial"], ["active", "Paying"], ["past_due", "Payment failed"], ["canceled", "Cancelled"], ["none", "No card"]];
const label = (s: string) => ({ trialing: "Trial", active: "Paying", past_due: "Payment failed", canceled: "Cancelled", none: "No card" } as Record<string, string>)[s] ?? s;
const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "—");

export default function VenueTable({ rows, noVenue, initialStatus }: { rows: VenueRow[]; noVenue: { id: string; email: string; created_at: string; provider: string }[]; initialStatus: string }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState(initialStatus);
  const list = useMemo(() => {
    const t = q.trim().toLowerCase();
    return rows.filter((r) => (status === "all" || r.status === status) && (!t || [r.name, r.slug, r.owner_email, r.owner_name].some((x) => x?.toLowerCase().includes(t))));
  }, [rows, q, status]);

  return (
    <>
      <div className="orders-bar">
        <input className="adm-search" style={{ marginBottom: 0 }} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search venue, link or email" aria-label="Search venues" />
        <div className="seg" role="group" aria-label="Filter by plan">
          {STATUS.map(([k, l]) => <button key={k} type="button" aria-pressed={status === k} onClick={() => setStatus(k)}>{l} <span style={{ opacity: .6 }}>{k === "all" ? rows.length : rows.filter((r) => r.status === k).length}</span></button>)}
        </div>
      </div>
      <div className="adm-table-wrap">
        <table className="adm-table">
          <thead><tr><th>Venue</th><th>Owner</th><th>Joined</th><th>Plan</th><th>Dishes</th><th>Orders 30d</th><th>Revenue 30d</th><th>AI used</th><th>Last sign-in</th></tr></thead>
          <tbody>
            {list.map((r) => (
              <tr key={r.id} onClick={() => router.push(`/admin/venues/${r.id}`)}>
                <td><b>{r.name}</b>{r.unread > 0 && <span className="pill st-past_due" style={{ marginLeft: 8 }}>{r.unread} new</span>}<small>/m/{r.slug} · {r.type}</small></td>
                <td>{r.owner_email}<small>{r.owner_name || "—"} · {r.provider}</small></td>
                <td>{day(r.created_at)}</td>
                <td><span className={`pill st-${r.status}`}>{label(r.status)}</span><small>{r.status === "trialing" ? `ends ${day(r.trial_end)}` : r.status === "active" ? `renews ${day(r.current_period_end)}` : ""}</small></td>
                <td>{r.dishes}</td>
                <td>{r.orders30}<small>{r.lastOrder ? `last ${ago(r.lastOrder)}` : ""}</small></td>
                <td>${Math.round(r.revenue30).toLocaleString("en-US")}</td>
                <td>{r.aiUsed}<small>{r.imports} imports · {r.images} images</small></td>
                <td>{r.last_sign_in ? ago(r.last_sign_in) : "—"}</td>
              </tr>
            ))}
            {!list.length && <tr><td colSpan={9} style={{ textAlign: "center", color: "var(--dim)", cursor: "default" }}>No venues match.</td></tr>}
          </tbody>
        </table>
      </div>
      {noVenue.length > 0 && (status === "all" || status === "none") && (
        <div className="card" style={{ marginTop: 16 }}>
          <div className="card-head"><h3>Signed up, no venue yet ({noVenue.length})</h3></div>
          {noVenue.map((u) => <div className="mini-order" key={u.id} style={{ gridTemplateColumns: "1fr auto" }}><div className="what"><b>{u.email}</b><span>{u.provider}</span></div><em style={{ fontWeight: 400, color: "var(--dim)" }}>{ago(u.created_at)}</em></div>)}
        </div>
      )}
    </>
  );
}
