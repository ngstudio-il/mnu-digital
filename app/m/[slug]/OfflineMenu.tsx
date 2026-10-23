import "@/styles/guest.css";
import { isRtl } from "@/lib/languages";
import type { UiStrings } from "@/lib/i18n";

export default function OfflineMenu({ name, lang, ui }: { name: string; lang: string; ui: UiStrings }) {
  return (
    <div className="g" lang={lang} dir={isRtl(lang) ? "rtl" : "ltr"} style={{ ["--brand" as string]: "#1f2829" }}>
      <header className="g-head"><small>{ui.menu.toUpperCase()}</small><h1>{name}</h1></header>
      <p className="g-empty">{ui.offline}</p>
    </div>
  );
}
