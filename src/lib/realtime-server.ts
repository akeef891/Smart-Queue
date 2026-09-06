import { getBrowserSupabaseKey, getBrowserSupabaseUrl } from "@/lib/realtime-channel";

export function getServerSupabaseUrl() {
  const explicit = getBrowserSupabaseUrl();
  if (explicit) return explicit;

  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) return "";
  try {
    const host = new URL(databaseUrl).hostname;
    const match = host.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    if (match) return `https://${match[1]}.supabase.co`;
  } catch {
    return "";
  }
  return "";
}

export function getServerSupabaseKey() {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_SECRET_KEY?.trim() ||
    getBrowserSupabaseKey()
  );
}

export function serverRealtimeKeyKind() {
  if (process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() || process.env.SUPABASE_SECRET_KEY?.trim()) {
    return "service-role";
  }
  if (getBrowserSupabaseKey()) {
    return "anon";
  }
  return "none";
}
