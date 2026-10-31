import "server-only";
import { esc } from "./index";

// To a Stripe subscriber whose Stripe subscription we cancelled: set up payment with PayPal to keep the menu online.
export function billingMoveEmail({ firstName, venue, until, link }: { firstName: string; venue: string; until: string | null; link: string }) {
  const day = until ? new Date(until).toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Jerusalem" }) : null;
  const hi = firstName ? `Hi ${firstName},` : "Hi,";
  const lines = [
    `Thanks for trying mnu.digital${venue ? ` with ${venue}` : ""}.`,
    `We've moved our payments to PayPal, so we've cancelled your subscription with our old payment provider. You won't be charged there.`,
    day ? `Your menu stays online as usual until ${day}.` : "",
    `To keep your menu online after that, sign in and set up your monthly subscription with PayPal ($39/month). Your first payment is taken when you set it up, then once a month. You can pay with a PayPal account or a card.`,
    `Your menu, dishes, photos and QR codes stay exactly as they are.`,
  ].filter(Boolean);
  const subject = "Keep your mnu.digital menu online";
  const text = `${hi}\n\n${lines.join("\n\n")}\n\nSet up payment: ${link}\n\nQuestions? Just reply to this email.\n\nThe mnu.digital team`;
  const html = `<div style="font-family:Arial,sans-serif;max-width:540px;color:#1f2829;font-size:15px;line-height:1.6">
  <img src="https://www.mnu.digital/assets/mnu-logo.png" alt="mnu.digital" height="34" style="display:block;margin:0 0 24px" />
  <p style="margin:0 0 14px">${esc(hi)}</p>
  ${lines.map((l) => `<p style="margin:0 0 14px">${esc(l)}</p>`).join("\n  ")}
  <p style="margin:24px 0"><a href="${esc(link)}" style="background:#1f2829;color:#fff;text-decoration:none;padding:13px 24px;border-radius:99px;display:inline-block;font-weight:bold">Set up payment</a></p>
  <p style="margin:0 0 14px;color:#7c8789">Questions? Just reply to this email.</p>
  <p style="margin:0">The mnu.digital team</p>
</div>`;
  return { subject, text, html };
}
