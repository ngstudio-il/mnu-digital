"use client";
import { useEffect, useMemo, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { useDash } from "@/components/dashboard/VenueContext";
import { AreaChart, BarChart, RankList } from "@/components/dashboard/charts";
import { browserZone, startOfDayIn } from "@/lib/timezone";
import { money } from "@/lib/format";
import { language } from "@/lib/languages";

type Data = {
  views: number; visitors: number; dish_views: number; orders: number; revenue: number;
  daily: { day: string; views: number; visitors: number }[];
  hourly: { hour: number; views: number }[];
  orders_daily: { day: string; orders: number; revenue: number }[];
  top_viewed: { name: string; views: number }[];
  top_ordered: { name: string; qty: number; revenue: number }[];
  langs: { lang: string; views: number }[];
};
type Range = "today" | "7" | "30" | "90" | "day";
const RANGES: [Range, string][] = [["today", "Today"], ["7", "7 days"], ["30", "30 days"], ["90", "90 days"], ["day", "Pick a day"]];
const DAY = 86400000;

export default function AnalyticsPage() {
  const { venue } = useDash();
  const tz = venue.timezone || browserZone();
  const [range, setRange] = useState<Range>("7");
  const [day, setDay] = useState(() => new Date().toISOString().slice(0, 10));
  const [data, setData] = useState<Data | null>(null);
  const [err, setErr] = useState("");
  const [now, setNow] = useState<number | null>(null);

  // [from, to) in the venue's time zone, plus the calendar days it covers.
  const span = useMemo(() => {
    if (range === "day") { const from = startOfDayIn(tz, new Date(`${day}T12:00:00Z`)); return { from, to: new Date(from.getTime() + DAY), days: 1 }; }
    const today = startOfDayIn(tz);
    const days = range === "today" ? 1 : Number(range);
    return { from: new Date(today.getTime() - (days - 1) * DAY), to: new Date(Date.now() + 60000), days };
  }, [range, day, tz]);
  const single = span.days === 1;

  useEffect(() => {
    let live = true;
    setErr("");
    supabaseBrowser().rpc("venue_analytics", { p_venue: venue.id, p_from: span.from.toISOString(), p_to: span.to.toISOString(), p_tz: tz })
      .then(({ data, error }: { data: Data | null; error: { code?: string; message: string } | null }) => {
        if (!live) return;
        if (error) return setErr(error.code === "PGRST202" ? "Analytics need a database update first (0019_analytics.sql)." : error.message);
        setData(data);
      });
    return () => { live = false; };
  }, [venue.id, span, tz]);

  useEffect(() => {
    const poll = () => supabaseBrowser().rpc("menu_now", { p_venue: venue.id }).then(({ data }: { data: number | null }) => setNow(data ?? 0), () => {});
    poll();
    const t = setInterval(() => { if (!document.hidden) poll(); }, 15000);
    return () => clearInterval(t);
  }, [venue.id]);

  const fmtDay = (d: Date) => d.toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "UTC" });
  // Every day in the range, with zero for days without views, so gaps show as gaps.
  const viewsSeries = useMemo(() => {
    if (!data) return [];
    if (single) {
      const byHour = new Map(data.hourly.map((h) => [h.hour, h.views]));
      return Array.from({ length: 24 }, (_, h) => ({ label: `${String(h).padStart(2, "0")}:00`, value: byHour.get(h) ?? 0, tip: `${String(h).padStart(2, "0")}:00–${String(h).padStart(2, "0")}:59` }));
    }
    const byDay = new Map(data.daily.map((d) => [d.day, d]));
    const [y, m, dd] = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(span.from).split("-").map(Number);
    const first = new Date(Date.UTC(y, m - 1, dd));
    return Array.from({ length: span.days }, (_, i) => {
      const d = new Date(first.getTime() + i * DAY);
      const key = d.toISOString().slice(0, 10), row = byDay.get(key);
      return { label: fmtDay(d), value: row?.views ?? 0, tip: `${d.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" })} · ${row?.visitors ?? 0} visitors` };
    });
  }, [data, single, span, tz]);
  const hours = useMemo(() => {
    const byHour = new Map((data?.hourly ?? []).map((h) => [h.hour, h.views]));
    return Array.from({ length: 24 }, (_, h) => ({ label: `${h}`, value: byHour.get(h) ?? 0, tip: `${String(h).padStart(2, "0")}:00–${String(h).padStart(2, "0")}:59` }));
  }, [data]);
  const peak = hours.reduce((b, h, i) => (h.value > hours[b].value ? i : b), 0);
  const conv = data && data.visitors ? Math.round((data.orders / data.visitors) * 1000) / 10 : null;

  return (
    <div className="an">
      <div className="an-bar">
        <div className="seg" role="group" aria-label="Date range">
          {RANGES.map(([k, l]) => <button key={k} type="button" aria-pressed={range === k} onClick={() => setRange(k)}>{l}</button>)}
        </div>
        {range === "day" && <input type="date" className="an-date" value={day} max={new Date().toISOString().slice(0, 10)} onChange={(e) => e.target.value && setDay(e.target.value)} aria-label="Day" />}
        <span className="note">Times in {tz.replace(/_/g, " ")}</span>
      </div>

      {err && <div className="card"><p className="note" style={{ color: "var(--coral)" }}>{err}</p></div>}

      <div className="an-kpis">
        <div className="kpi live"><small><i />Viewing now</small><b>{now ?? "–"}</b><span>people with your menu open</span></div>
        <div className="kpi"><small>Menu views</small><b>{data ? data.views.toLocaleString() : "–"}</b><span>{data ? `${data.visitors.toLocaleString()} unique visitors` : ""}</span></div>
        <div className="kpi"><small>Dishes opened</small><b>{data ? data.dish_views.toLocaleString() : "–"}</b><span>{data && data.visitors ? `${(data.dish_views / data.visitors).toFixed(1)} per visitor` : ""}</span></div>
        <div className="kpi"><small>Orders</small><b>{data ? data.orders.toLocaleString() : "–"}</b><span>{conv !== null ? `${conv}% of visitors ordered` : ""}</span></div>
        <div className="kpi"><small>Revenue</small><b>{data ? money(data.revenue, venue.currency) : "–"}</b><span>{data && data.orders ? `${money(data.revenue / data.orders, venue.currency)} per order` : ""}</span></div>
      </div>

      <div className="card an-wide">
        <div className="card-head"><h3>{single ? "Menu views by hour" : "Menu views"}</h3><span className="note">{data ? `${data.views.toLocaleString()} views` : ""}</span></div>
        {data && <AreaChart data={viewsSeries} unit="views" />}
      </div>

      <div className="an-grid">
        <div className="card">
          <div className="card-head"><h3>Most viewed dishes</h3><span className="note">opened by guests</span></div>
          <RankList rows={(data?.top_viewed ?? []).map((d) => ({ name: d.name, value: d.views }))} unit="views" empty="No dishes opened yet in this period." />
        </div>
        <div className="card">
          <div className="card-head"><h3>Most ordered</h3><span className="note">by quantity</span></div>
          <RankList rows={(data?.top_ordered ?? []).map((d) => ({ name: d.name, value: Number(d.qty), detail: money(d.revenue, venue.currency) }))} unit="ordered" empty="No orders yet in this period." />
        </div>
        {!single && (
          <div className="card">
            <div className="card-head"><h3>Busiest hours</h3><span className="note">{data && hours[peak].value ? `Peak ${String(peak).padStart(2, "0")}:00` : ""}</span></div>
            {data && <BarChart data={hours} unit="views" highlight={peak} />}
          </div>
        )}
        <div className="card">
          <div className="card-head"><h3>Menu languages</h3><span className="note">what guests read in</span></div>
          <RankList rows={(data?.langs ?? []).map((l) => ({ name: l.lang === "?" ? "Unknown" : language(l.lang).name, value: l.views }))} unit="views" empty="No views yet in this period." />
        </div>
      </div>
    </div>
  );
}
