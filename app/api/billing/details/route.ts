import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { isCountry } from "@/lib/countries";
import { resolveVenue } from "@/lib/admin";
import { supabaseAdmin } from "@/lib/supabase/admin";

const clip = (v: unknown, n: number) => String(v ?? "").trim().slice(0, n);

// Saves the owner's billing details (for invoices). Called before payment and from Settings.
export async function POST(request: Request) {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Please log in again." }, { status: 401 });
  // The owner's venue, or the venue an admin is helping in support mode.
  const venue = await resolveVenue(supabase, user.id, "id, owner_id");
  if (!venue) return NextResponse.json({ error: "Venue not found." }, { status: 404 });
  const b = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const country = clip(b.country, 2).toUpperCase(), name = clip(b.name, 160);
  if (!isCountry(country)) return NextResponse.json({ error: "Choose your country." }, { status: 400 });
  if (name.length < 2) return NextResponse.json({ error: "Add the name for your invoices." }, { status: 400 });
  const db = venue.owner_id === user.id ? supabase : supabaseAdmin();
  const { error } = await db.from("billing_profiles").upsert({
    venue_id: venue.id, country, name, tax_id: clip(b.tax_id, 40) || null, address: clip(b.address, 300) || null, updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: /billing_profiles/.test(error.message) ? "Database update missing (0025_billing_profiles.sql)." : "Couldn’t save your billing details." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
