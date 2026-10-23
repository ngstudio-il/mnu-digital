import { NextResponse } from "next/server";
import { DRAFT_COOKIE, DRAFT_DAYS, DRAFT_NAME_COOKIE } from "@/lib/lp";

// From the try-it page to sign-up: remembers the visitor's draft menu (and venue name) in a cookie
// on the main site, so it is added to their dashboard once they have an account.
export function GET(request: Request) {
  const url = new URL(request.url);
  const draft = url.searchParams.get("draft");
  const name = (url.searchParams.get("name") ?? "").trim().slice(0, 80);
  const res = NextResponse.redirect(new URL("/signup", url.origin));
  const opts = { path: "/", maxAge: DRAFT_DAYS * 86400, sameSite: "lax" as const, secure: url.protocol === "https:" };
  if (draft && /^[0-9a-f-]{36}$/.test(draft)) res.cookies.set(DRAFT_COOKIE, draft, opts);
  if (name) res.cookies.set(DRAFT_NAME_COOKIE, name, opts);
  return res;
}
