import "server-only";
import type { User } from "@supabase/supabase-js";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { esc, sendEmail } from "./index";

// Emails to the mnu.digital team about new customers. Failures never block the user's flow.
const TEAM = process.env.SUPPORT_EMAIL || "office@ngstudio.co.il";
const card = (label: string, title: string, rows: [string, string][], link?: { href: string; text: string }) => `<div style="font-family:Arial,sans-serif;max-width:520px;color:#1f2829">
  <p style="font-size:13px;color:#7c8789;margin:0 0 6px">${esc(label)}</p>
  <h2 style="margin:0 0 14px;font-size:20px">${esc(title)}</h2>
  <table style="font-size:14px;border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="padding:4px 16px 4px 0;color:#7c8789">${esc(k)}</td><td style="padding:4px 0">${esc(v)}</td></tr>`).join("")}</table>
  ${link ? `<p style="margin:20px 0 0"><a href="${link.href}" style="background:#363d41;color:#fff;text-decoration:none;padding:11px 20px;border-radius:99px;display:inline-block">${esc(link.text)}</a></p>` : ""}
</div>`;

// Once per user: marks the account so a second login doesn't send it again.
export async function notifySignup(user: User, origin: string) {
  try {
    const meta = user.user_metadata ?? {};
    if (meta.signup_notified) return;
    const db = supabaseAdmin();
    await db.auth.admin.updateUserById(user.id, { user_metadata: { ...meta, signup_notified: true } });
    // Accounts from before these alerts existed are only marked, not announced.
    if (Date.now() - new Date(user.created_at).getTime() > 24 * 3600 * 1000) return;
    const name = meta.full_name ?? meta.name ?? "";
    const provider = user.app_metadata?.provider === "google" ? "Google" : "Email";
    await sendEmail({
      to: TEAM,
      replyTo: user.email ?? undefined,
      subject: `New sign-up: ${name || user.email}`,
      text: `${name || "Someone"} (${user.email}) signed up with ${provider}.${meta.venue_name ? ` Venue: ${meta.venue_name}.` : ""}\n\n${origin}/admin`,
      html: card("New sign-up", name || user.email || "New user", [["Email", user.email ?? ""], ["Signed up with", provider], ...(meta.venue_name ? [["Venue", String(meta.venue_name)] as [string, string]] : [])], { href: `${origin}/admin`, text: "Open admin" }),
    });
  } catch (e) { console.error("signup alert failed", e); }
}

export async function notifySubscription(kind: "trial" | "paid" | "canceled", venueId: string, origin: string, extra: [string, string][] = []) {
  try {
    const db = supabaseAdmin();
    const { data: venue } = await db.from("venues").select("name, owner_id").eq("id", venueId).maybeSingle();
    const { data: owner } = venue ? await db.auth.admin.getUserById(venue.owner_id) : { data: null };
    const email = owner?.user?.email ?? "";
    const titles = { trial: "New subscription · free trial started", paid: "Trial converted · first payment", canceled: "Subscription canceled" };
    const name = venue?.name ?? "A venue";
    await sendEmail({
      to: TEAM,
      replyTo: email || undefined,
      subject: `${titles[kind]}: ${name}`,
      text: `${titles[kind]}\n${name} (${email})\n${extra.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${origin}/admin/venues/${venueId}`,
      html: card(titles[kind], name, [["Owner", email], ...extra], { href: `${origin}/admin/venues/${venueId}`, text: "Open in admin" }),
    });
  } catch (e) { console.error("subscription alert failed", e); }
}
