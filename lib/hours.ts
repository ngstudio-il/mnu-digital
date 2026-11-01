// Weekly opening hours (Settings → General → On your menu), shown on the guest menu.
// A day with no ranges is closed. A range that ends at or before it starts runs past midnight.
export const DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayKey = (typeof DAYS)[number];
export type Range = [string, string]; // "HH:MM" 24-hour
export type Schedule = { format: "24" | "12"; days: Partial<Record<DayKey, Range[]>> };

const mins = (t: string) => { const [h, m] = t.split(":").map(Number); return (h || 0) * 60 + (m || 0); };

export function formatTime(t: string, format: "24" | "12") {
  const [h, m] = t.split(":").map(Number);
  if (format === "24") return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
  const h12 = h % 12 || 12;
  return `${h12}${m ? `:${String(m).padStart(2, "0")}` : ""} ${h < 12 ? "AM" : "PM"}`;
}

// Day names in the menu's language, Sunday first (index = Date.getDay()).
export function dayNames(lang: string, style: "short" | "long" = "short") {
  const f = new Intl.DateTimeFormat(lang, { weekday: style, timeZone: "UTC" });
  return DAYS.map((_, i) => f.format(new Date(Date.UTC(2024, 0, 7 + i))));
}

const rangesText = (r: Range[], format: "24" | "12") => r.map(([a, b]) => `${formatTime(a, format)}–${formatTime(b, format)}`).join(", ");

// Days with the same hours grouped: [["Mon–Fri", "8:00–22:00"], ["Sat", "Closed"]]. Starts the week on weekStart.
export function summarize(s: Schedule, lang: string, closedLabel: string, weekStart = 0): [string, string][] {
  const names = dayNames(lang);
  const order = DAYS.map((_, i) => (i + weekStart) % 7);
  const out: { from: number; to: number; text: string }[] = [];
  for (const i of order) {
    const r = s.days[DAYS[i]] ?? [];
    const text = r.length ? rangesText(r, s.format) : closedLabel;
    const last = out[out.length - 1];
    if (last && last.text === text) last.to = i; else out.push({ from: i, to: i, text });
  }
  return out.map((g) => [g.from === g.to ? names[g.from] : `${names[g.from]}–${names[g.to]}`, g.text]);
}

// Whether the venue is open at this moment in its time zone, and until when.
export function openNow(s: Schedule, tz?: string | null): { open: boolean; until?: string } {
  const now = new Date();
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz || undefined, weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(now).map((x) => [x.type, x.value]));
  const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(p.weekday);
  const t = Number(p.hour) * 60 + Number(p.minute);
  for (const [a, b] of s.days[DAYS[day]] ?? []) {
    const start = mins(a), end = mins(b);
    if (end > start ? t >= start && t < end : t >= start) return { open: true, until: formatTime(b, s.format) };
  }
  // Yesterday's ranges that run past midnight.
  for (const [a, b] of s.days[DAYS[(day + 6) % 7]] ?? []) {
    if (mins(b) <= mins(a) && t < mins(b)) return { open: true, until: formatTime(b, s.format) };
  }
  return { open: false };
}

export const hasSchedule = (s?: Schedule | null) => !!s && DAYS.some((d) => (s.days[d] ?? []).length);
