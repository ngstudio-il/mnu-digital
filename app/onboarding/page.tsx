import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import OnboardingForm from "./OnboardingForm";

export const metadata = { title: "Set up your venue · mnu.digital" };
export const dynamic = "force-dynamic";

export default async function Onboarding() {
  if (!isSupabaseConfigured) redirect("/signup");
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: venue } = await supabase.from("venues").select("id").eq("owner_id", user.id).maybeSingle();
  if (venue) redirect("/dashboard");
  const meta = user.user_metadata ?? {};
  return <OnboardingForm defaultName={meta.venue_name ?? ""} ownerName={meta.full_name ?? meta.name ?? ""} />;
}
