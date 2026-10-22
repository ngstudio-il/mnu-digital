import "server-only";
import { supabaseServer } from "@/lib/supabase/server";

// Returns the signed-in user when they are an admin (see public.admins), otherwise null.
export async function getAdmin() {
  const supabase = await supabaseServer();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase.rpc("is_admin");
  return data === true ? { user, supabase } : null;
}

export const SUPPORT_COOKIE = "mnu_support_venue";

type Sb = Awaited<ReturnType<typeof supabaseServer>>;

// The venue an API request acts on: the admin's support-mode venue, or the user's own venue.
export async function resolveVenue(supabase: Sb, userId: string, columns = "id, type") {
  const { cookies } = await import("next/headers");
  const supportId = (await cookies()).get(SUPPORT_COOKIE)?.value;
  if (supportId) {
    const { data: isAdmin } = await supabase.rpc("is_admin");
    if (isAdmin === true) {
      const { data } = await supabase.from("venues").select(columns).eq("id", supportId).maybeSingle();
      if (data) return data as unknown as Record<string, string>;
    }
  }
  const { data } = await supabase.from("venues").select(columns).eq("owner_id", userId).order("created_at").limit(1).maybeSingle();
  return (data as unknown as Record<string, string> | null) ?? null;
}
