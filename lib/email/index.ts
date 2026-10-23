import "server-only";

// Sends a transactional email through Resend (https://resend.com). No-op when RESEND_API_KEY is missing.
export const emailFrom = () => process.env.NOTIFY_FROM || "mnu.digital <onboarding@resend.dev>";

export async function sendEmail({ to, subject, html, text, replyTo }: { to: string; subject: string; html: string; text: string; replyTo?: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: "not_configured" as const };
  const from = emailFrom();
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  if (res.ok) return { ok: true as const };
  const j = (await res.json().catch(() => ({}))) as { message?: string };
  return { ok: false as const, reason: `resend_${res.status}`, message: j.message ?? "" };
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
