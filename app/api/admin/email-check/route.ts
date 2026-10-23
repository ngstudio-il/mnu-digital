import { NextResponse } from "next/server";
import { getAdmin } from "@/lib/admin";
import { emailFrom, sendEmail } from "@/lib/email";

// Admin-only check of support email alerts: is Resend set up, and does a test email go through.
// Never returns the key itself.
export async function GET() {
  if (!(await getAdmin())) return NextResponse.json({ error: "Admins only." }, { status: 403 });
  const to = process.env.SUPPORT_EMAIL || "office@ngstudio.co.il";
  const report: Record<string, unknown> = { resendKeySet: !!process.env.RESEND_API_KEY, from: emailFrom(), to };
  if (!process.env.RESEND_API_KEY) return NextResponse.json({ ...report, result: "RESEND_API_KEY is not set in Vercel, so no alerts are sent." });
  const r = await sendEmail({ to, subject: "mnu.digital test: support alerts work", text: "This is a test of the support chat email alerts.", html: "<p>This is a test of the support chat email alerts. If you can read this, they work.</p>" });
  return NextResponse.json({ ...report, result: r.ok ? "sent: check the inbox (and spam)" : `failed: ${r.reason} ${"message" in r ? r.message : ""}` }, { headers: { "Cache-Control": "no-store" } });
}
