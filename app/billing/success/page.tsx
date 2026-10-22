import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { stripe, syncSubscription } from "@/lib/stripe";

export const dynamic = "force-dynamic";

// Stripe sends the customer here after checkout. Sync right away so they don't wait for the webhook.
export default async function Success({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  if (session_id) {
    try {
      const s = stripe();
      const session = await s.checkout.sessions.retrieve(session_id);
      const { data: venue } = await supabase.from("venues").select("id").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
      if (venue && session.metadata?.venue_id === venue.id && session.subscription) {
        const id = typeof session.subscription === "string" ? session.subscription : session.subscription.id;
        await syncSubscription(await s.subscriptions.retrieve(id));
      }
    } catch {
      // The webhook will catch up; the dashboard checks again.
    }
  }
  redirect("/dashboard");
}
