"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient, isBrowserRealtimeConfigured } from "@/lib/supabase-browser";
import { QUEUE_CHANGED_EVENT, queueRealtimeChannel } from "@/lib/realtime-channel";

export type RealtimeStatus = "off" | "connecting" | "live" | "reconnecting";

const isDev = process.env.NODE_ENV !== "production";

export function useQueueRealtime(queueId: string, onChange: () => void) {
  const [status, setStatus] = useState<RealtimeStatus>(() =>
    isBrowserRealtimeConfigured() ? "connecting" : "off"
  );
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const channelName = queueRealtimeChannel(queueId);
    const client = getSupabaseBrowserClient();

    if (!client) {
      if (isDev) {
        console.warn("[realtime] subscription skipped: NEXT_PUBLIC_SUPABASE_URL and anon/publishable key are required", {
          channel: channelName,
          event: QUEUE_CHANGED_EVENT,
        });
      }
      return;
    }

    if (isDev) {
      console.info("[realtime] subscription attempt", {
        channel: channelName,
        event: QUEUE_CHANGED_EVENT,
      });
    }

    let debounce: ReturnType<typeof setTimeout> | undefined;

    const channel = client.channel(channelName, {
      config: {
        private: false,
        broadcast: { ack: false, self: true },
      },
    });

    channel.on("broadcast", { event: QUEUE_CHANGED_EVENT }, (payload) => {
      if (isDev) {
        console.info("[realtime] broadcast received", {
          channel: channelName,
          event: QUEUE_CHANGED_EVENT,
          payload: payload?.payload ?? payload,
        });
      }
      clearTimeout(debounce);
      debounce = setTimeout(() => {
        if (isDev) {
          console.info("[realtime] refetch triggered", { channel: channelName });
        }
        onChangeRef.current();
      }, 80);
    });

    channel.subscribe((state, error) => {
      if (isDev) {
        console.info("[realtime] subscription status", {
          channel: channelName,
          state,
          error: error ? { message: error.message, name: error.name } : null,
        });
      }
      if (state === "SUBSCRIBED") setStatus("live");
      else if (state === "TIMED_OUT" || state === "CHANNEL_ERROR" || state === "CLOSED") {
        setStatus("reconnecting");
      }
    });

    return () => {
      clearTimeout(debounce);
      void client.removeChannel(channel);
    };
  }, [queueId]);

  return status;
}
