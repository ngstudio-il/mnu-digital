import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { sendEmail, esc } from "@/lib/email";
import { ipHash } from "@/lib/lp";
import { CONTACT_TOPICS } from "@/lib/contact";

const TEAM = process.env.SUPPORT_EMAIL || "office@ngstudio.co.il";
const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

// Public: the home page contact form. Saved for Admin → Inquiries and emailed to the team.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  // Bots fill in the hidden "website" field; pretend it worked.
  if (clip(body.website, 200)) return NextResponse.json({ ok: true });
  const name = clip(body.name, 120), email = clip(body.email, 200).toLowerCase(), phone = clip(body.phone, 40);
  const business = clip(body.business, 160), message = clip(body.message, 5000);
  const topic = (CONTACT_TOPICS as readonly string[]).includes(String(body.topic)) ? String(body.topic) : "Other";
  if (!name) return NextResponse.json({ error: "Please add your name." }, { status: 400 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: "Please add a valid email address." }, { status: 400 });
  if (message.length < 2) return NextResponse.json({ error: "Please write your message." }, { status: 400 });

  const hash = ipHash(request);
  let saved = false;
  if (process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const db = supabaseAdmin();
    const since = new Date(Date.now() - 3600 * 1000).toISOString();
    const { count } = await db.from("contact_messages").select("id", { count: "exact", head: true }).eq("ip_hash", hash).gte("created_at", since);
    if ((count ?? 0) >= 10) return NextResponse.json({ error: "You’ve sent a few messages already. We’ll be in touch soon." }, { status: 429 });
    const { error } = await db.from("contact_messages").insert({ name, email, phone: phone || null, business: business || null, topic, message, ip_hash: hash });
    saved = !error;
    if (error) console.error("contact save failed", error.message);
  }

  const origin = new URL(request.url).origin;
  const rows: [string, string][] = [["Topic", topic], ["Name", name], ["Email", email], ...(phone ? [["Phone", phone] as [string, string]] : []), ...(business ? [["Business", business] as [string, string]] : [])];
  const sent = await sendEmail({
    to: TEAM,
    replyTo: email,
    subject: `Contact form · ${topic} · ${name}`,
    text: `${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${message}\n\n${origin}/admin/inquiries`,
    html: `<div style="font-family:Arial,sans-serif;max-width:560px;color:#1f2829">
  <p style="font-size:13px;color:#7c8789;margin:0 0 6px">Contact form · ${esc(topic)}</p>
  <h2 style="margin:0 0 14px;font-size:20px">${esc(name)}</h2>
  <table style="font-size:14px;border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#7c8789">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`).join("")}</table>
  <div style="margin:18px 0 0;padding:16px;border-radius:12px;background:#f4f4f1;font-size:15px;line-height:1.55;white-space:pre-wrap">${esc(message)}</div>
  <p style="margin:20px 0 0;font-size:13px;color:#7c8789">Reply to this email to answer ${esc(name)} directly.</p>
  <p style="margin:14px 0 0"><a href="${origin}/admin/inquiries" style="background:#363d41;color:#fff;text-decoration:none;padding:11px 20px;border-radius:99px;display:inline-block">Open inquiries</a></p>
</div>`,
  });
  if (!saved && !sent.ok) return NextResponse.json({ error: `Couldn’t send your message. Email us at ${TEAM}.` }, { status: 500 });
  return NextResponse.json({ ok: true });
}
