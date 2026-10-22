import { NextResponse } from "next/server";
import { getAdmin, SUPPORT_COOKIE } from "@/lib/admin";

// Admin only: open a customer's dashboard (sets a short-lived cookie) or leave support mode.
export async function POST(request: Request) {
  const admin = await getAdmin();
  if (!admin) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const { venueId } = (await request.json().catch(() => ({}))) as { venueId?: string };
  if (!venueId || !/^[0-9a-f-]{36}$/.test(venueId)) return NextResponse.json({ error: "Bad venue" }, { status: 400 });
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SUPPORT_COOKIE, venueId, { httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 4 });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SUPPORT_COOKIE, "", { path: "/", maxAge: 0 });
  return res;
}
