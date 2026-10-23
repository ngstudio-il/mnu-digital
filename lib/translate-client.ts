// Runs /api/translate until the menu's translations are up to date. One run at a time per tab.
type Progress = { remaining: number; error?: string; done: boolean };
let running: Promise<Progress> | null = null;
let again = false;

export function syncTranslations(onProgress?: (p: Progress) => void): Promise<Progress> {
  if (running) { again = true; return running; }
  running = (async () => {
    let last = Infinity;
    let result: Progress = { remaining: 0, done: true };
    for (let i = 0; i < 60; i++) {
      again = false;
      const res = await fetch("/api/translate", { method: "POST" }).catch(() => null);
      const json = res ? await res.json().catch(() => ({})) : {};
      if (!res || !res.ok) { result = { remaining: last === Infinity ? 0 : last, error: json.error ?? "Couldn’t translate right now.", done: true }; break; }
      const remaining = Number(json.remaining) || 0;
      // Stop when nothing is left, or when a round made no progress (and nothing changed meanwhile).
      if (remaining === 0 || (remaining >= last && !again)) { result = { remaining, done: true }; break; }
      last = remaining;
      onProgress?.({ remaining, done: false });
    }
    onProgress?.(result);
    return result;
  })().finally(() => { running = null; });
  return running;
}
