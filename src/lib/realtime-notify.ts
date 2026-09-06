import {
  QUEUE_CHANGED_EVENT,
  queueRealtimeChannel,
} from "@/lib/realtime-channel";
import {
  getServerSupabaseKey,
  getServerSupabaseUrl,
  serverRealtimeKeyKind,
} from "@/lib/realtime-server";

const isDev = process.env.NODE_ENV !== "production";

/** Fire-and-forget after a successful Prisma commit. Payload is queueId only. */
export function notifyQueueChanged(queueId: string) {
  void sendQueueChanged(queueId);
}

async function sendQueueChanged(queueId: string) {
  const url = getServerSupabaseUrl();
  const key = getServerSupabaseKey();
  const channel = queueRealtimeChannel(queueId);
  const keyKind = serverRealtimeKeyKind();

  if (!url || !key) {
    console.warn("[realtime] broadcast skipped: missing Supabase URL or key", {
      queueId,
      channel,
      event: QUEUE_CHANGED_EVENT,
      hasUrl: Boolean(url),
      hasKey: Boolean(key),
    });
    return;
  }

  const endpoint = `${url.replace(/\/$/, "")}/realtime/v1/api/broadcast`;
  const body = {
    messages: [
      {
        topic: channel,
        event: QUEUE_CHANGED_EVENT,
        payload: { queueId },
        private: false,
      },
    ],
  };

  if (isDev) {
    console.info("[realtime] broadcast sending", {
      queueId,
      channel,
      event: QUEUE_CHANGED_EVENT,
      keyKind,
    });
  }

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    if (!response.ok) {
      console.error("[realtime] broadcast failed", {
        queueId,
        channel,
        event: QUEUE_CHANGED_EVENT,
        keyKind,
        status: response.status,
        body: text.slice(0, 300),
      });
      return;
    }

    if (isDev) {
      console.info("[realtime] broadcast succeeded", {
        queueId,
        channel,
        event: QUEUE_CHANGED_EVENT,
        keyKind,
        status: response.status,
      });
    }
  } catch (err) {
    console.error("[realtime] broadcast request error", {
      queueId,
      channel,
      event: QUEUE_CHANGED_EVENT,
      error: err instanceof Error ? err.message : "unknown",
    });
  }
}
