export default function SetupNotice() {
  return (
    <p className="preview-note" role="note">
      Supabase isn’t connected yet. Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and <code>NEXT_PUBLIC_SUPABASE_ANON_KEY</code> in
      Vercel → Settings → Environment Variables, then redeploy.
    </p>
  );
}
