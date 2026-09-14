"use client";

import { useEffect, useRef, useState } from "react";
import { getSupabaseBrowserClient, isBrowserRealtimeConfigured } from "@/lib/supabase-browser";
import { QUEUE_CHANGED_EVENT, queueRealtimeChannel } from "@/lib/realtime-channel";
import type { RealtimeStatus } from "@/hooks/use-queue-realtime";

const isDev = process.env.NODE_ENV !== "production";

export function useBusinessQueuesRealtime(queueIds: string[], onChange: () => void) {
  const [status, setStatus] = useState<RealtimeStatus>(() =>
    isBrowserRealtimeConfigured() && queueIds.length > 0 ? "connecting" : "off"
  );
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const idsKey = queueIds.join(",");

  useEffect(() => {
    const ids = idsKey ? idsKey.split(",") : [];
    const client = getSupabaseBrowserClient();

    if (!client || ids.length === 0) {
      return;
    }

    let debounce: ReturnType<typeof setTimeout> | undefined;

    const channels = ids.map((queueId) => {
      const channelName = queueRealtimeChannel(queueId);
      const channel = client.channel(channelName, {
        config: {
          private: false,
          broadcast: { ack: false, self: true },
        },
      });

      channel.on("broadcast", { event: QUEUE_CHANGED_EVENT }, () => {
        clearTimeout(debounce);
        debounce = setTimeout(() => onChangeRef.current(), 80);
      });

      channel.subscribe((state) => {
        if (isDev) {
          console.info("[realtime] business dashboard subscription", { channel: channelName, state });
        }
        if (state === "SUBSCRIBED") setStatus("live");
        else if (state === "TIMED_OUT" || state === "CHANNEL_ERROR" || state === "CLOSED") {
          setStatus("reconnecting");
        }
      });

      return channel;
    });

    return () => {
      clearTimeout(debounce);
      for (const channel of channels) {
        void client.removeChannel(channel);
      }
    };
  }, [idsKey]);

  return status;
}
