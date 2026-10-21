// Public Supabase connection values. The anon key is designed to be public: row level
// security in supabase/migrations decides what each visitor may read or change.
// Vercel environment variables, when set, take precedence.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://jcavbfycrflwpexfigts.supabase.co";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpjYXZiZnljcmZsd3BleGZpZ3RzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTI1OTcwNTMsImV4cCI6MjEwODE3MzA1M30.sCOsca8p2R2HWTzaMCWRM3dLDJz-8BBuotsMDcM2Ehg";
export const isSupabaseConfigured = Boolean(SUPABASE_URL && SUPABASE_ANON_KEY);
