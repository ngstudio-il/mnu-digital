import { SUPABASE_URL } from "./supabase/env";

export function money(n: number | string, currency = "$") {
  const v = Number(n) || 0;
  return currency + v.toLocaleString("en-US", { minimumFractionDigits: v % 1 ? 2 : 0, maximumFractionDigits: 2 });
}

export function slugify(s: string) {
  return (
    s.toLowerCase().replace(/&/g, "and").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 48) || "my-venue"
  );
}

export function photoUrl(path: string | null | undefined) {
  if (!path) return null;
  if (path.startsWith("/") || path.startsWith("http")) return path;
  return `${SUPABASE_URL}/storage/v1/object/public/dish-photos/${path}`;
}

export function ago(iso: string) {
  const m = Math.round((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  if (m < 60 * 24) return `${Math.round(m / 60)} h ago`;
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

export function planSummary(sub: { status: string; trial_end: string | null; current_period_end: string | null; cancel_at_period_end: boolean } | null) {
  if (!sub) return { title: "No plan", detail: "" };
  const day = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" }) : "");
  if (sub.status === "trialing") {
    const left = sub.trial_end ? Math.max(0, Math.ceil((new Date(sub.trial_end).getTime() - Date.now()) / 86400000)) : 0;
    return { title: left <= 2 ? `Trial ends in ${left} day${left === 1 ? "" : "s"}` : "mnu.digital Pro · Free trial", detail: sub.cancel_at_period_end ? `Ends ${day(sub.trial_end)}, no charge` : `First charge of $39 on ${day(sub.trial_end)}` };
  }
  if (sub.status === "past_due") return { title: "Payment failed", detail: "Update your card to keep your menu online" };
  return { title: "Pro · $39/month", detail: sub.cancel_at_period_end ? `Cancels on ${day(sub.current_period_end)}` : `Renews on ${day(sub.current_period_end)}` };
}

export const STATUS_LABEL = { new: "New", preparing: "Preparing", ready: "Ready", done: "Completed", cancelled: "Declined" } as const;
export const LABELS = ["Vegan", "Vegetarian", "Gluten-free", "Contains nuts", "Dairy", "Fish", "Spicy"];
export const LANGS: Record<string, string> = { en: "English", he: "Hebrew", ar: "Arabic", ru: "Russian", fr: "French" };
export const BRANDS = ["#1f2829", "#6f9393", "#3a2a21", "#b07656", "#2f4a6b"];
