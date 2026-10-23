import "@/styles/legal.css";
import Link from "next/link";

export type LegalSection = { title?: string; body: (string | React.ReactNode | { list: string[] })[] };

// A plain, readable page for legal texts (privacy, accessibility).
export default function LegalPage({ title, updated, intro, sections }: { title: string; updated: string; intro: React.ReactNode[]; sections: LegalSection[] }) {
  return (
    <div className="legal">
      <header className="legal-head">
        <Link href="/" className="legal-logo" aria-label="mnu.digital home"><img src="/assets/mnu-logo.png" alt="mnu.digital" /></Link>
        <Link href="/" className="legal-back">← Back to home</Link>
      </header>
      <main className="legal-main">
        <h1>{title}</h1>
        <p className="legal-updated">Last Updated: {updated}</p>
        {intro.map((p, i) => <p key={i}>{p}</p>)}
        {sections.map((s, i) => (
          <section key={i}>
            {s.title && <h2>{s.title}</h2>}
            {s.body.map((p, j) => (p && typeof p === "object" && "list" in p ? <ul key={j}>{p.list.map((li, k) => <li key={k}>{li}</li>)}</ul> : <p key={j}>{p as React.ReactNode}</p>))}
          </section>
        ))}
      </main>
      <footer className="legal-foot">
        <span>© 2026 MNU Digital LLC</span>
        <nav><Link href="/terms">Terms of Service</Link><Link href="/privacy">Privacy Policy</Link><Link href="/accessibility">Accessibility</Link><Link href="/">mnu.digital</Link></nav>
      </footer>
    </div>
  );
}

export const contactLink = <a href="mailto:office@ngstudio.co.il">contact us here</a>;
