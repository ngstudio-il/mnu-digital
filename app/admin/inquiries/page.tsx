"use client";
import { useCallback, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/client";
import { ago } from "@/lib/format";

type Msg = { id: string; created_at: string; name: string; email: string; phone: string | null; business: string | null; topic: string; message: string; handled: boolean };

// Messages from the home page contact form (they're also emailed to the team).
export default function Inquiries() {
  const [msgs, setMsgs] = useState<Msg[] | null>(null);
  const [err, setErr] = useState("");
  const [show, setShow] = useState<"open" | "all">("open");

  const load = useCallback(async () => {
    const { data, error } = await supabaseBrowser().from("contact_messages").select("*").order("created_at", { ascending: false }).limit(300);
    if (error) setErr(/contact_messages/.test(error.message) ? "Database update missing: run 0024_contact.sql in Supabase." : error.message);
    else setMsgs(data as Msg[]);
  }, []);

  useEffect(() => {
    load();
    const sb = supabaseBrowser();
    const ch = sb.channel("admin-inquiries").on("postgres_changes", { event: "*", schema: "public", table: "contact_messages" }, () => load()).subscribe();
    return () => { sb.removeChannel(ch); };
  }, [load]);

  async function toggle(m: Msg) {
    setMsgs((list) => list?.map((x) => (x.id === m.id ? { ...x, handled: !m.handled } : x)) ?? null);
    const { error } = await supabaseBrowser().from("contact_messages").update({ handled: !m.handled }).eq("id", m.id);
    if (error) load();
  }

  if (err) return <div className="empty"><b>Can’t load inquiries</b>{err}</div>;
  if (!msgs) return <p className="note">Loading…</p>;
  const open = msgs.filter((m) => !m.handled).length;
  const list = show === "open" ? msgs.filter((m) => !m.handled) : msgs;

  return (
    <div className="inq">
      <div className="inq-tabs">
        <button type="button" className={show === "open" ? "on" : ""} onClick={() => setShow("open")}>Open <i>{open}</i></button>
        <button type="button" className={show === "all" ? "on" : ""} onClick={() => setShow("all")}>All <i>{msgs.length}</i></button>
      </div>
      {!list.length ? (
        <div className="empty"><b>{show === "open" ? "All caught up" : "No inquiries yet"}</b>Messages from the Contact form on the home page show up here.</div>
      ) : list.map((m) => (
        <article key={m.id} className={`card inq-card${m.handled ? " done" : ""}`}>
          <div className="inq-head">
            <div>
              <span className="pill">{m.topic}</span>
              <h3>{m.name}{m.business ? <small> · {m.business}</small> : null}</h3>
              <p className="note"><a href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.topic}`)}`}>{m.email}</a>{m.phone ? <> · <a href={`tel:${m.phone}`}>{m.phone}</a></> : null} · {ago(m.created_at)}</p>
            </div>
            <div className="inq-actions">
              <a className="btn sm" href={`mailto:${m.email}?subject=${encodeURIComponent(`Re: ${m.topic}`)}`}>Reply</a>
              <button className="btn ghost sm" type="button" onClick={() => toggle(m)}>{m.handled ? "Reopen" : "Mark handled"}</button>
            </div>
          </div>
          <p className="inq-body" dir="auto">{m.message}</p>
        </article>
      ))}
    </div>
  );
}
