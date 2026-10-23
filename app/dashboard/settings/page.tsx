import Link from "next/link";
import { SETTINGS_SECTIONS } from "./sections";

// Settings starts with a choice of section; each one is its own page.
export default function SettingsHome() {
  return (
    <div className="set-hub">
      {SETTINGS_SECTIONS.map((s) => (
        <Link key={s.href} href={s.href} className="set-hub-card">
          <span className="set-hub-icon"><svg viewBox="0 0 24 24" aria-hidden="true">{s.icon}</svg></span>
          <b>{s.label}</b>
          <span>{s.desc}</span>
          <i aria-hidden="true">→</i>
        </Link>
      ))}
    </div>
  );
}
