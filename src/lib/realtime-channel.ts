/** Canonical public Broadcast topic. Must match client subscribe and server HTTP send. */
export function queueRealtimeChannel(queueId: string) {
  return `queue:${queueId}`;
}

/** Canonical Broadcast event. Must match client listener and server send. */
export const QUEUE_CHANGED_EVENT = "queue_changed";

export function getBrowserSupabaseUrl() {
  return process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
}

export function getBrowserSupabaseKey() {
  return (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    ""
  );
}

export function isBrowserRealtimeConfigured() {
  return Boolean(getBrowserSupabaseUrl() && getBrowserSupabaseKey());
}
