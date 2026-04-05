import { createClient } from "@supabase/supabase-js";

// Server-side client (with service key — never expose to browser)
export function getSupabaseAdmin() {
  return createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_KEY!
  );
}

// Browser-safe client (anon key)
export function getSupabaseClient() {
  return createClient(
    import.meta.env.PUBLIC_SUPABASE_URL,
    import.meta.env.PUBLIC_SUPABASE_ANON_KEY
  );
}

export type Term = {
  id: string;
  name: string;
  full_name: string;
  category: string;
  definition: string;
  created_at: string;
};

export type Connection = {
  id: string;
  from_id: string;
  to_id: string;
  weight: number;
};
