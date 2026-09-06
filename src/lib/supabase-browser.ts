import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getBrowserSupabaseKey, getBrowserSupabaseUrl, isBrowserRealtimeConfigured } from "@/lib/realtime-channel";

export { isBrowserRealtimeConfigured };

let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowserClient(): SupabaseClient | null {
  const url = getBrowserSupabaseUrl();
  const anonKey = getBrowserSupabaseKey();
  if (!url || !anonKey) return null;
  if (!browserClient) {
    browserClient = createClient(url, anonKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return browserClient;
}
