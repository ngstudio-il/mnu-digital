import "server-only";

// Sends a transactional email through Resend (https://resend.com). No-op when RESEND_API_KEY is missing.
export async function sendEmail({ to, subject, html, text, replyTo }: { to: string; subject: string; html: string; text: string; replyTo?: string }) {
  const key = process.env.RESEND_API_KEY;
  if (!key) return { ok: false, reason: "not_configured" as const };
  const from = process.env.NOTIFY_FROM || "mnu.digital <onboarding@resend.dev>";
  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from, to, subject, html, text, ...(replyTo ? { reply_to: replyTo } : {}) }),
  });
  return res.ok ? { ok: true as const } : { ok: false as const, reason: `resend_${res.status}` };
}

export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
