import { redirect } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import Shell from "@/components/dashboard/Shell";
import type { Venue } from "@/lib/types";

export const metadata = { title: "Dashboard · mnu.digital" };
export const dynamic = "force-dynamic";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  if (!isSupabaseConfigured) redirect("/signup");
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: venue } = await supabase.from("venues").select("*").eq("owner_id", user.id).order("created_at").limit(1).maybeSingle();
  if (!venue) redirect("/onboarding");
  const meta = user.user_metadata ?? {};
  return (
    <Shell
      initialVenue={venue as Venue}
      user={{ id: user.id, name: meta.full_name ?? meta.name ?? "", email: user.email ?? "", provider: user.app_metadata?.provider ?? "email" }}
    >
      {children}
    </Shell>
  );
}
