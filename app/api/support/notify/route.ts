import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { esc, sendEmail } from "@/lib/email";

// Emails the support team every time a venue owner writes in the chat.
const SUPPORT_EMAIL = process.env.SUPPORT_EMAIL || "office@ngstudio.co.il";

export async function POST(request: Request) {
  const { id } = (await request.json().catch(() => ({}))) as { id?: string };
  if (!id || !/^[0-9a-f-]{36}$/.test(id)) return NextResponse.json({ ok: false }, { status: 400 });
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });

  // Readable only if this user owns the venue (row level security), so nobody can trigger emails for others.
  const { data: msg } = await supabase.from("support_messages").select("id, venue_id, sender, body, created_at").eq("id", id).maybeSingle();
  if (!msg || msg.sender !== "owner" || Date.now() - new Date(msg.created_at).getTime() > 5 * 60000) return NextResponse.json({ ok: false }, { status: 404 });

  const db = supabaseAdmin();

  const { data: venue } = await db.from("venues").select("id, name").eq("id", msg.venue_id).single();
  const origin = new URL(request.url).origin;
  const link = `${origin}/admin/venues/${msg.venue_id}`;
  const name = venue?.name ?? "A venue";
  const result = await sendEmail({
    to: SUPPORT_EMAIL,
    replyTo: user.email ?? undefined,
    subject: `New support message from ${name}`,
    text: `${name} (${user.email}) wrote:\n\n${msg.body}\n\nReply in the admin: ${link}`,
    html: `<div style="font-family:Arial,sans-serif;max-width:520px;color:#1f2829">
      <p style="font-size:13px;color:#7c8789;margin:0 0 6px">New support message</p>
      <h2 style="margin:0 0 4px;font-size:20px">${esc(name)}</h2>
      <p style="margin:0 0 16px;color:#7c8789;font-size:13px">${esc(user.email ?? "")}</p>
      <div style="background:#f4f4f1;border-radius:14px;padding:14px 16px;white-space:pre-wrap;font-size:15px;line-height:1.5">${esc(msg.body)}</div>
      <p style="margin:20px 0 0"><a href="${link}" style="background:#363d41;color:#fff;text-decoration:none;padding:11px 20px;border-radius:99px;display:inline-block">Reply in admin</a></p>
    </div>`,
  });
  if (!result.ok) console.error("support email failed", result);
  return NextResponse.json({ ok: result.ok, ...(result.ok ? {} : { reason: result.reason }) });
}
