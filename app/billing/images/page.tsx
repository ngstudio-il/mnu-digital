import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { grantImagePackFromSession, stripe } from "@/lib/stripe";
import { captureImagePack } from "@/lib/paypal";

export const dynamic = "force-dynamic";

// Stripe (session_id) or PayPal (token = order id) returns here after an image pack purchase.
// Credit it right away; the webhook does the same, and a pack is only ever credited once.
export default async function ImagesBought({ searchParams }: { searchParams: Promise<{ session_id?: string; token?: string }> }) {
  const { session_id, token } = await searchParams;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (token) {
    try {
      const { data: venue } = await supabase.from("venues").select("id").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
      if (venue) await captureImagePack(token, venue.id);
    } catch {
      // The webhook will capture and credit it.
    }
  }
  if (session_id) {
    try {
      const session = await stripe().checkout.sessions.retrieve(session_id);
      const { data: venue } = await supabase.from("venues").select("id").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
      if (venue && session.metadata?.venue_id === venue.id) await grantImagePackFromSession(session);
    } catch {
      // The webhook will credit the pack.
    }
  }
  redirect("/dashboard/menu?images=bought");
}
