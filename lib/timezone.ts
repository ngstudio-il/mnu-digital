// Time helpers that follow the venue's own time zone (Settings → General), falling back to the
// browser's when none is set. Used for "today" on the dashboard.
export const browserZone = () => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC"; } catch { return "UTC"; } };

export function allZones(): string[] {
  try { return (Intl as unknown as { supportedValuesOf: (k: string) => string[] }).supportedValuesOf("timeZone"); } catch { return [browserZone(), "UTC"]; }
}

function parts(date: Date, tz: string) {
  const p = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: tz, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit" })
    .formatToParts(date).map((x) => [x.type, x.value]));
  return { y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute, s: +p.second };
}

// Minutes the zone is ahead of UTC at that moment.
function offsetMinutes(date: Date, tz: string) {
  const q = parts(date, tz);
  return (Date.UTC(q.y, q.m - 1, q.d, q.h, q.min, q.s) - Math.floor(date.getTime() / 1000) * 1000) / 60000;
}

export function hourIn(tz: string, date = new Date()) { return parts(date, tz).h; }

export function startOfDayIn(tz: string, date = new Date()) {
  const q = parts(date, tz);
  const guess = new Date(Date.UTC(q.y, q.m - 1, q.d));
  return new Date(guess.getTime() - offsetMinutes(guess, tz) * 60000);
}

export function zoneLabel(tz: string) {
  try {
    const off = offsetMinutes(new Date(), tz);
    const sign = off >= 0 ? "+" : "−", a = Math.abs(off);
    return `${tz.replace(/_/g, " ")} (UTC${sign}${String(Math.floor(a / 60)).padStart(2, "0")}:${String(a % 60).padStart(2, "0")})`;
  } catch { return tz; }
}
