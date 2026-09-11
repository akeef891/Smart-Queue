"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicTicketSnapshot } from "@/lib/actions/ticket";
import {
  detectTicketNotification,
  getNotificationPermission,
  playNotificationSound,
  requestNotificationPermission,
  sendBrowserNotification,
  triggerHapticFeedback,
  type BrowserPermissionState,
  type CustomerNotification,
} from "@/lib/notifications";

const AUTO_DISMISS_MS = 8000;

export function useTicketNotifications({
  ticket,
  trackingToken,
}: {
  ticket: PublicTicketSnapshot;
  trackingToken: string;
}) {
  const [permission, setPermission] = useState<BrowserPermissionState>("default");
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const prevSnapshotRef = useRef<PublicTicketSnapshot | null>(null);
  const notifiedKeysRef = useRef<Set<string>>(new Set());
  const originalTitleRef = useRef<string>("");

  // Initialize permission and loaded deduplication keys from sessionStorage
  useEffect(() => {
    setPermission(getNotificationPermission());
    if (typeof document !== "undefined") {
      originalTitleRef.current = document.title;
    }

    try {
      const stored = sessionStorage.getItem(`sq_notified_${trackingToken}`);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          notifiedKeysRef.current = new Set(parsed);
        }
      }
    } catch {
      // sessionStorage unavailable
    }
  }, [trackingToken]);

  const dismissNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
    if (typeof document !== "undefined" && originalTitleRef.current) {
      document.title = originalTitleRef.current;
    }
  }, []);

  const handleRequestPermission = useCallback(async () => {
    const res = await requestNotificationPermission();
    setPermission(res);

    if (res === "granted") {
      // Send a welcoming confirmation notification
      sendBrowserNotification({
        title: "Smart Queue",
        body: "Notifications enabled! We'll alert you when your turn approaches or is called.",
        tag: `sq_welcome_${trackingToken}`,
      });
      playNotificationSound("alert");
    }
    return res;
  }, [trackingToken]);

  // Monitor ticket updates and detect state changes
  useEffect(() => {
    // If first mount, store the current snapshot as baseline without triggering alerts
    if (!prevSnapshotRef.current) {
      prevSnapshotRef.current = ticket;
      return;
    }

    const prev = prevSnapshotRef.current;
    const detected = detectTicketNotification(prev, ticket, notifiedKeysRef.current);

    if (detected) {
      const { notification, dedupeKey } = detected;

      // 1. Record dedupeKey in memory and session storage
      notifiedKeysRef.current.add(dedupeKey);
      try {
        sessionStorage.setItem(
          `sq_notified_${trackingToken}`,
          JSON.stringify(Array.from(notifiedKeysRef.current))
        );
      } catch {
        // Ignore session storage write failures
      }

      // 2. Add to in-page notifications
      setNotifications((prevList) => [
        // keep at most 3 notifications at once, newest first
        notification,
        ...prevList.filter((n) => n.category !== notification.category).slice(0, 2),
      ]);

      // 3. Audio & Haptic feedback
      const isCalled = notification.category === "CALLED";
      playNotificationSound(isCalled ? "called" : "alert");
      triggerHapticFeedback(isCalled ? "called" : "alert");

      // 4. Native Browser Notification (if granted)
      sendBrowserNotification({
        title: notification.title,
        body: notification.message,
        tag: `sq_ticket_${trackingToken}`,
        requireInteraction: isCalled,
        onClick: () => {
          dismissNotification(notification.id);
        },
      });

      // 5. Update document title for background tabs
      if (typeof document !== "undefined") {
        document.title = isCalled
          ? `🔔 (YOUR TURN) ${ticket.label} — Smart Queue`
          : `🔔 (Update) ${ticket.label} — Smart Queue`;
      }
    }

    // Update the snapshot reference
    prevSnapshotRef.current = ticket;
  }, [ticket, trackingToken, dismissNotification]);

  // Handle auto-dismissal for non-persistent notifications
  useEffect(() => {
    const nonPersistent = notifications.filter((n) => !n.persistent);
    if (nonPersistent.length === 0) return;

    const timers = nonPersistent.map((n) => {
      const elapsed = Date.now() - n.timestamp;
      const remaining = Math.max(0, AUTO_DISMISS_MS - elapsed);
      return setTimeout(() => {
        dismissNotification(n.id);
      }, remaining);
    });

    return () => {
      timers.forEach((t) => clearTimeout(t));
    };
  }, [notifications, dismissNotification]);

  // Restore document title when tab becomes visible and active
  useEffect(() => {
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") {
        // If no CALLED notifications remain active, restore title
        const hasCalled = notifications.some((n) => n.category === "CALLED");
        if (!hasCalled && originalTitleRef.current) {
          document.title = originalTitleRef.current;
        }
      }
    }

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [notifications]);

  return {
    permission,
    requestPermission: handleRequestPermission,
    notifications,
    dismissNotification,
  };
}
