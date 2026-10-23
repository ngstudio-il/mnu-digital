"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dashboard/settings", label: "General" },
  { href: "/dashboard/settings/design", label: "Design" },
  { href: "/dashboard/settings/languages", label: "Languages" },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  return (
    <>
      <nav className="sub-tabs" aria-label="Settings">
        {TABS.map((t) => <Link key={t.href} href={t.href} aria-current={path === t.href ? "page" : undefined}>{t.label}</Link>)}
      </nav>
      {children}
    </>
  );
}
