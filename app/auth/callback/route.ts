import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { notifySignup } from "@/lib/email/admin-alerts";

// Google sign-in and email confirmation links land here with a one-time code.
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  if (code) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (data.user) await notifySignup(data.user, origin);
      return NextResponse.redirect(`${origin}/dashboard`);
    }
  }
  return NextResponse.redirect(`${origin}/login`);
}
