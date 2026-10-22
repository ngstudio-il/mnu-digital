"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";

type Msg = { id: string; venue_id: string; sender: "owner" | "admin"; body: string; created_at: string; read_by_owner: boolean; read_by_admin: boolean };

const time = (iso: string) => new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

// One conversation per venue. `as` decides which side of the chat this screen is.
export function ChatThread({ venueId, as, onRead }: { venueId: string; as: "owner" | "admin"; onRead?: () => void }) {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const end = useRef<HTMLDivElement>(null);
  const readCol = as === "owner" ? "read_by_owner" : "read_by_admin";
  const other = as === "owner" ? "admin" : "owner";

  const markRead = useCallback(async () => {
    await supabaseBrowser().from("support_messages").update({ [readCol]: true }).eq("venue_id", venueId).eq("sender", other).eq(readCol, false);
    onRead?.();
  }, [venueId, readCol, other, onRead]);

  useEffect(() => {
    const sb = supabaseBrowser();
    sb.from("support_messages").select("*").eq("venue_id", venueId).order("created_at").then(({ data }: { data: Msg[] | null }) => { setMsgs(data ?? []); markRead(); });
    const ch = sb.channel(`support-${venueId}-${as}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `venue_id=eq.${venueId}` }, (p: { new: Msg }) => {
        setMsgs((m) => (m && !m.some((x) => x.id === p.new.id) ? [...m, p.new] : m));
        if (p.new.sender === other) markRead();
      })
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [venueId, as, other, markRead]);

  useEffect(() => { end.current?.scrollIntoView({ block: "end" }); }, [msgs]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true); setErr("");
    const { data, error } = await supabaseBrowser().from("support_messages").insert({ venue_id: venueId, sender: as, body, [readCol]: true }).select().single();
    setBusy(false);
    if (error || !data) {
      const missing = error?.code === "42P01" || error?.message?.includes("support_messages");
      return setErr(missing ? "Chat isn’t set up yet (database update missing)." : `Message not sent: ${error?.message ?? "unknown error"}`);
    }
    setMsgs((m) => (m && !m.some((x) => x.id === data.id) ? [...m, data] : m));
    setText("");
    if (as === "owner") fetch("/api/support/notify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ id: data.id }) }).catch(() => {});
  }

  return (
    <div className="chat">
      <div className="chat-list">
        {as === "owner" && (
          <div className="chat-msg them"><p>Hi! This is the mnu.digital team. Ask us anything about your menu, orders or billing. We usually reply within a few hours.</p></div>
        )}
        {msgs === null ? <p className="note">Loading…</p> : msgs.map((m) => (
          <div key={m.id} className={`chat-msg ${m.sender === as ? "me" : "them"}`}><p>{m.body}</p><span>{time(m.created_at)}</span></div>
        ))}
        <div ref={end} />
      </div>
      <form className="chat-form" onSubmit={send}>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(e); } }}
          placeholder={as === "owner" ? "Write a message…" : "Reply to this venue…"}
          rows={2}
          aria-label="Message"
        />
        <button className="btn sm" type="submit" disabled={busy || !text.trim()}>Send</button>
      </form>
      {err && <p className="chat-err">{err}</p>}
    </div>
  );
}

// Floating help button in the owner dashboard.
export default function SupportChat({ venueId }: { venueId: string }) {
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);

  const count = useCallback(async () => {
    const { count: n } = await supabaseBrowser().from("support_messages").select("id", { count: "exact", head: true })
      .eq("venue_id", venueId).eq("sender", "admin").eq("read_by_owner", false);
    setUnread(n ?? 0);
  }, [venueId]);

  useEffect(() => {
    count();
    const sb = supabaseBrowser();
    const ch = sb.channel(`support-badge-${venueId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "support_messages", filter: `venue_id=eq.${venueId}` }, () => count())
      .subscribe();
    return () => { sb.removeChannel(ch); };
  }, [venueId, count]);

  return (
    <>
      {open && (
        <div className="chat-pop" role="dialog" aria-label="Chat with mnu.digital">
          <div className="chat-head">
            <div><b>Chat with us</b><span><i />The mnu.digital team</span></div>
            <button className="x" type="button" onClick={() => setOpen(false)} aria-label="Close chat">×</button>
          </div>
          <ChatThread venueId={venueId} as="owner" onRead={() => setUnread(0)} />
        </div>
      )}
      <button className="chat-fab" type="button" onClick={() => setOpen((o) => !o)} aria-label={open ? "Close chat" : "Chat with support"}>
        {open ? <span aria-hidden="true">×</span> : (
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" /><path d="M8 9h8M8 12h5" /></svg>
        )}
        {!open && unread > 0 && <em>{unread}</em>}
      </button>
    </>
  );
}
