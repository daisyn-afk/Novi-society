export function resolveSupabaseUrl() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) {
    throw new Error(
      "Missing required env var: SUPABASE_URL or NEXT_PUBLIC_SUPABASE_URL"
    );
  }
  return url;
}
