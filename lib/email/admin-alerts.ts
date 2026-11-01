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

export type Payment = { id: string; provider: "paypal" | "stripe"; kind: "subscription" | "image_pack"; amount: number; currency: string; payerName?: string; payerEmail?: string; paidAt?: string; note?: string };

// Every payment received, so an invoice can be issued for it (by hand in iCount for now).
// Recorded in public.payments first; a payment already there (a resent webhook) isn't emailed again.
export async function notifyPayment(venueId: string | null, origin: string, p: Payment) {
  try {
    const db = supabaseAdmin();
    const paidAt = p.paidAt ?? new Date().toISOString();
    const { data: saved, error } = await db.from("payments").upsert({
      id: p.id, venue_id: venueId, provider: p.provider, kind: p.kind, amount: p.amount, currency: p.currency,
      payer_name: p.payerName ?? null, payer_email: p.payerEmail ?? null, paid_at: paidAt,
    }, { onConflict: "id", ignoreDuplicates: true }).select("id");
    // No row back means it was already recorded. (Before 0023 there is no table: alert anyway.)
    if (!error && !saved?.length) return;
    const { data: venue } = venueId ? await db.from("venues").select("name, owner_id").eq("id", venueId).maybeSingle() : { data: null };
    const { data: owner } = venue ? await db.auth.admin.getUserById(venue.owner_id) : { data: null };
    const email = owner?.user?.email ?? "";
    const { count } = venueId ? await db.from("payments").select("id", { count: "exact", head: true }).eq("venue_id", venueId).eq("kind", "subscription") : { count: 0 };
    const name = venue?.name ?? "A venue";
    const amount = `${p.amount.toFixed(2)} ${p.currency}`;
    // What goes on the invoice, as the owner entered it before paying.
    const { data: bill } = venueId ? await db.from("billing_profiles").select("country, name, tax_id, address").eq("venue_id", venueId).maybeSingle() : { data: null };
    const { countryName } = await import("@/lib/countries");
    const what = p.kind === "image_pack" ? `AI image pack${p.note ? ` (${p.note})` : ""}` : `mnu.digital Pro, monthly${count === 1 ? " · first payment" : count ? ` · payment #${count}` : ""}`;
    const when = new Date(paidAt).toLocaleString("en-GB", { timeZone: "Asia/Jerusalem", day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" });
    const rows: [string, string][] = [
      ["Amount", amount], ["For", what], ["Paid", when], ["Via", p.provider === "paypal" ? "PayPal" : "Stripe"], ["Transaction", p.id.replace(/^\w+:/, "")],
      ["Payer", [p.payerName, p.payerEmail].filter(Boolean).join(" · ") || "—"], ["Account email", email],
      ["Invoice to", bill?.name ?? "— (no billing details)"], ["Country", bill?.country ? `${countryName(bill.country)} (${bill.country})` : "—"],
      ...(bill?.tax_id ? [["Tax ID", bill.tax_id] as [string, string]] : []), ...(bill?.address ? [["Address", bill.address] as [string, string]] : []),
    ];
    await sendEmail({
      to: TEAM,
      replyTo: p.payerEmail || email || undefined,
      subject: `Payment received · ${amount} · ${name}${count === 1 && p.kind === "subscription" ? " (first payment)" : ""}`,
      text: `Payment received: issue an invoice.\n${name}\n${rows.map(([k, v]) => `${k}: ${v}`).join("\n")}\n\n${origin}/admin${venueId ? `/venues/${venueId}` : ""}`,
      html: card("Payment received · issue an invoice", name, rows, { href: `${origin}/admin${venueId ? `/venues/${venueId}` : ""}`, text: "Open in admin" }),
    });
  } catch (e) { console.error("payment alert failed", e); }
}
