import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { cookies } from "next/headers";
import OnboardingForm from "./OnboardingForm";
import { DRAFT_COOKIE, DRAFT_NAME_COOKIE } from "@/lib/lp";

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
  // Coming from the try-it page: use the name typed there, and skip the starter categories (the menu is on its way).
  const jar = await cookies();
  const draftName = jar.get(DRAFT_NAME_COOKIE)?.value;
  return <OnboardingForm defaultName={draftName ?? meta.venue_name ?? ""} ownerName={meta.full_name ?? meta.name ?? ""} hasDraft={!!jar.get(DRAFT_COOKIE)} />;
}
