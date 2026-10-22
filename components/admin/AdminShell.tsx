"use client";
import "@/styles/app.css";
import "@/styles/dashboard.css";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

const NAV = [
  { href: "/admin", label: "Overview", icon: <><rect x="3" y="3" width="7" height="9" rx="2"/><rect x="14" y="3" width="7" height="5" rx="2"/><rect x="14" y="12" width="7" height="9" rx="2"/><rect x="3" y="16" width="7" height="5" rx="2"/></> },
  { href: "/admin/venues", label: "Venues", icon: <><path d="M3 21h18M5 21V8l7-5 7 5v13"/><path d="M10 21v-6h4v6"/></> },
  { href: "/admin/support", label: "Support", icon: <><path d="M4 5h16v11H9l-5 4z"/><path d="M8 9h8M8 12h5"/></> },
];

export default function AdminShell({ email, children }: { email: string; children: React.ReactNode }) {
  const path = usePathname();
  const router = useRouter();
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    const sb = supabaseBrowser();
    const count = async () => {
      const { count: n } = await sb.from("support_messages").select("id", { count: "exact", head: true }).eq("sender", "owner").eq("read_by_admin", false);
      setUnread(n ?? 0);
    };
    count();
    const ch = sb.channel("admin-support-badge").on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, () => count()).subscribe();
    const t = setInterval(() => { if (!document.hidden) count(); }, 20000);
    return () => { sb.removeChannel(ch); clearInterval(t); };
  }, []);

  const active = (href: string) => (href === "/admin" ? path === "/admin" : path.startsWith(href));
  const title = [...NAV].reverse().find((n) => active(n.href))?.label ?? "Admin";

  async function logout() {
    await supabaseBrowser().auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="shell">
      <aside className="side">
        <a className="logo" href="/"><img src="/assets/mnu-logo.png" alt="mnu.digital" /></a>
        <span className="admin-tag">Admin</span>
        <nav className="nav" aria-label="Admin">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} aria-current={active(n.href) ? "page" : undefined}>
              <svg viewBox="0 0 24 24">{n.icon}</svg>{n.label}
              {n.label === "Support" && unread > 0 && <span className="badge">{unread}</span>}
            </Link>
          ))}
        </nav>
        <div className="side-foot">
          <div className="me"><span className="avatar">{email.charAt(0).toUpperCase()}</span><div><b>{email}</b><span>Administrator</span></div></div>
        </div>
      </aside>
      <div className="main">
        <header className="top">
          <h1>{title}</h1>
          <div className="top-actions">
            <a className="btn ghost sm" href="/dashboard">My dashboard</a>
            <button className="btn ghost sm" type="button" onClick={logout}>Log out</button>
          </div>
        </header>
        <main className="view">{children}</main>
      </div>
    </div>
  );
}
