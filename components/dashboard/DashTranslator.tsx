"use client";
import { useEffect, useState } from "react";
import { isRtl } from "@/lib/languages";

// Shows the dashboard in the owner's language. The dashboard is written in English; this swaps
// the text of known interface strings (lib/dash-strings.json, translated once per language by
// /api/dash-i18n) in place, and keeps doing so as pages change. Only exact interface strings are
// touched, so dish names, orders and messages stay as written. Mark anything else to leave alone
// with translate="no".
const ATTRS = ["placeholder", "title", "aria-label", "alt"];
const SKIP = "script, style, textarea, code, pre, [translate='no'], [contenteditable='true']";

type Dict = Record<string, string>;

function compile(dict: Dict) {
  const patterns: { re: RegExp; out: string }[] = [];
  for (const [src, out] of Object.entries(dict)) {
    if (!src.includes("{n}") || src.replace(/\{n\}/g, "").replace(/[^A-Za-z]/g, "").length < 3) continue;
    const re = new RegExp("^" + src.split("{n}").map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("(.+?)") + "$");
    patterns.push({ re, out });
  }
  return (text: string): string | null => {
    const core = text.replace(/\s+/g, " ").trim();
    if (!core || !/[A-Za-z]/.test(core)) return null;
    let t = dict[core];
    if (t === undefined) {
      for (const p of patterns) {
        const m = core.match(p.re);
        if (m) { let i = 1; t = p.out.replace(/\{n\}/g, () => m[i++] ?? ""); break; }
      }
    }
    if (t === undefined || t === core) return null;
    const lead = text.match(/^\s*/)![0], trail = text.match(/\s*$/)![0];
    return lead + t + trail;
  };
}

export default function DashTranslator({ lang }: { lang: string }) {
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    document.documentElement.lang = lang;
    document.documentElement.dir = isRtl(lang) ? "rtl" : "ltr";
    if (lang === "en") return;
    const cacheKey = `mnu.dash.${lang}`;
    const texts = new WeakMap<Text, { src: string; out: string }>();
    const attrs = new WeakMap<Element, Record<string, { src: string; out: string }>>();
    let tr: ((s: string) => string | null) | null = null;
    let titleSrc = "";

    const doText = (n: Text) => {
      const cur = n.nodeValue ?? "";
      const rec = texts.get(n);
      if (rec && cur === rec.out) return;
      if (n.parentElement?.closest(SKIP)) return;
      const out = tr!(cur);
      if (out !== null) { texts.set(n, { src: cur, out }); n.nodeValue = out; }
    };
    const doAttrs = (el: Element) => {
      if (el.closest(SKIP)) return;
      const recs = attrs.get(el) ?? {};
      for (const a of ATTRS) {
        const cur = el.getAttribute(a);
        if (!cur || recs[a]?.out === cur) continue;
        const out = tr!(cur);
        if (out !== null) { recs[a] = { src: cur, out }; el.setAttribute(a, out); }
      }
      attrs.set(el, recs);
    };
    const run = (root: Node) => {
      if (!tr) return;
      if (root.nodeType === Node.TEXT_NODE) return doText(root as Text);
      if (root.nodeType !== Node.ELEMENT_NODE) return;
      const el = root as Element;
      doAttrs(el);
      el.querySelectorAll(ATTRS.map((a) => `[${a}]`).join(",")).forEach(doAttrs);
      const w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
      for (let n = w.nextNode(); n; n = w.nextNode()) doText(n as Text);
      if (document.title !== titleSrc) { const t = tr(document.title); if (t) { titleSrc = t; document.title = t; } }
    };

    const pending = new Set<Node>();
    let frame = 0;
    const obs = new MutationObserver((list) => {
      for (const m of list) {
        if (m.type === "characterData") pending.add(m.target);
        else if (m.type === "attributes") pending.add(m.target);
        else m.addedNodes.forEach((n) => pending.add(n));
      }
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; const nodes = [...pending]; pending.clear(); nodes.forEach(run); });
    });

    let known: Dict = {};
    const use = (dict: Dict) => { known = { ...known, ...dict }; tr = compile(known); run(document.body); };
    try { const cached = localStorage.getItem(cacheKey); if (cached) use(JSON.parse(cached)); } catch { /* storage unavailable */ }
    obs.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ATTRS });

    let stop = false;
    (async () => {
      const load = async () => {
        const res = await fetch(`/api/dash-i18n?lang=${encodeURIComponent(lang)}`).catch(() => null);
        const json = res?.ok ? await res.json() : null;
        if (json && !stop && Object.keys(json.strings ?? {}).length) { use(json.strings); try { localStorage.setItem(cacheKey, JSON.stringify(known)); } catch { /* full */ } }
        return json?.remaining ?? 0;
      };
      let remaining = await load();
      if (remaining > 0 && !stop) {
        setBusy(true);
        // First visit in this language: translate it now (shared with every owner afterwards).
        for (let i = 0; i < 12 && remaining > 0 && !stop; i++) {
          const res = await fetch("/api/dash-i18n", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ lang }) }).catch(() => null);
          if (!res?.ok) break;
          remaining = (await res.json()).remaining ?? 0;
          await load();
        }
        if (!stop) setBusy(false);
      }
    })();

    return () => { stop = true; obs.disconnect(); if (frame) cancelAnimationFrame(frame); };
  }, [lang]);

  return busy ? <div className="dash-i18n-busy" role="status" translate="no">Translating the dashboard into your language… (first time only)</div> : null;
}
