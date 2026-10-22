"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ChatThread } from "@/components/SupportChat";
import { ago } from "@/lib/format";

type Conv = { venue_id: string; name: string; last: string; at: string; unread: number };

export default function AdminSupport() {
  const [convs, setConvs] = useState<Conv[] | null>(null);
  const [open, setOpen] = useState<string | null>(null);

  const load = useCallback(async () => {
    const sb = supabaseBrowser();
    const { data } = await sb.from("support_messages").select("venue_id, sender, body, created_at, read_by_admin").order("created_at", { ascending: false }).limit(1000);
    const msgs = (data ?? []) as { venue_id: string; sender: string; body: string; created_at: string; read_by_admin: boolean }[];
    const ids = [...new Set(msgs.map((m) => m.venue_id))];
    const { data: venues } = ids.length ? await sb.from("venues").select("id, name").in("id", ids) : { data: [] as { id: string; name: string }[] };
    const names = new Map<string, string>(((venues ?? []) as { id: string; name: string }[]).map((v) => [v.id, v.name]));
    setConvs(ids.map((id) => {
      const mine = msgs.filter((m) => m.venue_id === id);
      return { venue_id: id, name: names.get(id) ?? "Venue", last: mine[0].body, at: mine[0].created_at, unread: mine.filter((m) => m.sender === "owner" && !m.read_by_admin).length };
    }));
  }, []);

  useEffect(() => {
    load();
    const sb = supabaseBrowser();
    const ch = sb.channel("admin-inbox").on("postgres_changes", { event: "*", schema: "public", table: "support_messages" }, () => load()).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [load]);

  useEffect(() => { if (!open && convs?.length) setOpen(convs[0].venue_id); }, [convs, open]);
  const current = convs?.find((c) => c.venue_id === open);

  return (
    <div className="inbox">
      <div className="inbox-list">
        {convs === null ? <p className="note">Loading…</p> : convs.length ? convs.map((c) => (
          <button key={c.venue_id} type="button" className="inbox-item" aria-pressed={open === c.venue_id} onClick={() => setOpen(c.venue_id)}>
            <b>{c.name}{c.unread > 0 && <em>{c.unread}</em>}</b><span>{c.last}</span><small>{ago(c.at)}</small>
          </button>
        )) : <div className="empty"><b>No conversations yet</b>Messages from venues appear here as soon as they’re sent.</div>}
      </div>
      {current && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <div className="card-head" style={{ padding: "16px 18px", margin: 0, borderBottom: "1px solid var(--line)" }}>
            <h3>{current.name}</h3><Link href={`/admin/venues/${current.venue_id}`}>Venue details →</Link>
          </div>
          <div style={{ height: 520, display: "flex", flexDirection: "column" }}><ChatThread key={current.venue_id} venueId={current.venue_id} as="admin" onRead={load} /></div>
        </div>
      )}
    </div>
  );
}
