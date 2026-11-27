import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = "https://ewaycmegjhxsctdtlqvd.supabase.co";

const SUPABASE_KEY = "sb_publishable_00EVjy5fSeEGx8hxcsutIA_pfz0SPvM";

export const supabase = createClient(
  SUPABASE_URL,
  SUPABASE_KEY,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: window.localStorage
    }
  }
);
