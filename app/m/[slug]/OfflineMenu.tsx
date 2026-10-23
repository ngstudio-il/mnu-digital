import "@/styles/guest.css";
import { isRtl } from "@/lib/languages";
import type { UiStrings } from "@/lib/i18n";

export default function OfflineMenu({ name, lang, ui, message }: { name: string; lang: string; ui: UiStrings; message?: string }) {
  return (
    <div className="g" lang={lang} dir={isRtl(lang) ? "rtl" : "ltr"} >
      <header className="g-head"><small>{ui.menu.toUpperCase()}</small><h1>{name}</h1></header>
      <p className="g-empty">{message ?? ui.offline}</p>
    </div>
  );
}
