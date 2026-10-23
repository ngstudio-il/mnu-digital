import "server-only";
import { createHash } from "node:crypto";

// Shared bits of the public try-it page (lp.mnu.digital).
export const DRAFT_COOKIE = "mnu_draft";
export const DRAFT_NAME_COOKIE = "mnu_draft_name";
export { LP_PDF_MAX } from "./lp-limits";
export const DRAFT_DAYS = 14;

export function ipHash(request: Request) {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return createHash("sha256").update(`mnu-lp:${ip}`).digest("hex").slice(0, 32);
}
