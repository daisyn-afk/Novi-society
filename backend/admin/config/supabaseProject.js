export const DEFAULT_SUPABASE_URL = "https://hjelcmcfqogoflxkhhpj.supabase.co";

export function resolveSupabaseUrl() {
  return (
    process.env.SUPABASE_URL ||
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    DEFAULT_SUPABASE_URL
  );
}
