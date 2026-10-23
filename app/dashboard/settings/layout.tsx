"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SETTINGS_SECTIONS } from "./sections";

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const section = SETTINGS_SECTIONS.find((s) => s.href === path);
  if (!section) return <>{children}</>;
  return (
    <>
      <div className="sub-head">
        <Link href="/dashboard/settings" className="sub-back">← All settings</Link>
        <nav className="sub-tabs" aria-label="Settings">
          {SETTINGS_SECTIONS.map((s) => (
            <Link key={s.href} href={s.href} aria-current={path === s.href ? "page" : undefined}>
              <svg viewBox="0 0 24 24" aria-hidden="true">{s.icon}</svg>{s.label}
            </Link>
          ))}
        </nav>
      </div>
      {children}
    </>
  );
}
