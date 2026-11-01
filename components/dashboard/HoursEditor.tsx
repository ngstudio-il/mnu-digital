"use client";
import { DAYS, dayNames, type DayKey, type Range, type Schedule } from "@/lib/hours";

const EMPTY: Schedule = { format: "24", days: {} };

// Weekly opening hours: each day open or closed, with one or more time ranges (split shifts),
// shown to guests in 24-hour or AM/PM style.
export default function HoursEditor({ value, onChange }: { value?: Schedule; onChange: (s: Schedule) => void }) {
  const s = value ?? EMPTY;
  const names = dayNames("en", "long");
  const setDay = (d: DayKey, r: Range[]) => onChange({ ...s, days: { ...s.days, [d]: r } });
  const ranges = (d: DayKey) => s.days[d] ?? [];

  return (
    <div className="hours-ed">
      <div className="hours-top">
        <div className="seg" role="radiogroup" aria-label="Time format">
          <button type="button" role="radio" aria-checked={s.format === "24"} onClick={() => onChange({ ...s, format: "24" })}>24-hour</button>
          <button type="button" role="radio" aria-checked={s.format === "12"} onClick={() => onChange({ ...s, format: "12" })}>AM / PM</button>
        </div>
        {ranges("mon").length > 0 && <button type="button" className="link-btn" onClick={() => onChange({ ...s, days: Object.fromEntries(DAYS.map((d) => [d, ranges("mon").map((r) => [...r] as Range)])) })}>Copy Monday to every day</button>}
      </div>
      {DAYS.map((d, i) => {
        const r = ranges(d);
        const open = r.length > 0;
        return (
          <div className={`hours-day${open ? "" : " closed"}`} key={d}>
            <label className="hours-name">
              <button type="button" className="switch" role="switch" aria-checked={open} aria-label={`${names[i]} open`} onClick={() => setDay(d, open ? [] : [["09:00", "17:00"]])} />
              <span>{names[i]}</span>
            </label>
            <div className="hours-ranges">
              {open ? r.map(([a, b], j) => (
                <div className="hours-range" key={j}>
                  <input type="time" value={a} onChange={(e) => setDay(d, r.map((x, k) => (k === j ? [e.target.value, x[1]] : x)))} aria-label={`${names[i]} opens`} />
                  <span>–</span>
                  <input type="time" value={b} onChange={(e) => setDay(d, r.map((x, k) => (k === j ? [x[0], e.target.value] : x)))} aria-label={`${names[i]} closes`} />
                  {r.length > 1
                    ? <button type="button" className="hours-x" onClick={() => setDay(d, r.filter((_, k) => k !== j))} aria-label="Remove these hours">×</button>
                    : <button type="button" className="hours-add" onClick={() => setDay(d, [...r, [b, b]])} title="Add a second range, e.g. a lunch break">+ Split</button>}
                </div>
              )) : <span className="note">Closed</span>}
              {r.length > 1 && r.length < 4 && <button type="button" className="hours-add" onClick={() => setDay(d, [...r, [r[r.length - 1][1], r[r.length - 1][1]]])}>+ Add hours</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
