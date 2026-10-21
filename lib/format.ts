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

export const STATUS_LABEL = { new: "New", preparing: "Preparing", ready: "Ready", done: "Completed", cancelled: "Declined" } as const;
export const LABELS = ["Vegan", "Vegetarian", "Gluten-free", "Contains nuts", "Dairy", "Fish", "Spicy"];
export const LANGS: Record<string, string> = { en: "English", he: "Hebrew", ar: "Arabic", ru: "Russian", fr: "French" };
export const BRANDS = ["#1f2829", "#6f9393", "#3a2a21", "#b07656", "#2f4a6b"];
