import type { BrowserPermissionState } from "./types";

export function isBrowserNotificationSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): BrowserPermissionState {
  if (!isBrowserNotificationSupported()) {
    return "unsupported";
  }
  return Notification.permission as BrowserPermissionState;
}

export async function requestNotificationPermission(): Promise<BrowserPermissionState> {
  if (!isBrowserNotificationSupported()) {
    return "unsupported";
  }

  try {
    const permission = await Notification.requestPermission();
    return permission as BrowserPermissionState;
  } catch {
    // Fallback for older browsers using callback pattern
    return new Promise((resolve) => {
      try {
        Notification.requestPermission((permission) => {
          resolve(permission as BrowserPermissionState);
        });
      } catch {
        resolve("denied");
      }
    });
  }
}

export type BrowserNotificationPayload = {
  title: string;
  body: string;
  tag?: string;
  requireInteraction?: boolean;
  onClick?: () => void;
};

export function sendBrowserNotification(payload: BrowserNotificationPayload): boolean {
  if (!isBrowserNotificationSupported()) return false;
  if (Notification.permission !== "granted") return false;

  try {
    const notification = new Notification(payload.title, {
      body: payload.body,
      tag: payload.tag ?? "smartqueue-ticket",
      icon: "/favicon.ico",
      requireInteraction: Boolean(payload.requireInteraction),
    });

    notification.onclick = () => {
      try {
        window.focus();
      } catch {
        // window.focus might be restricted on some platforms
      }
      if (payload.onClick) {
        payload.onClick();
      }
      notification.close();
    };

    return true;
  } catch (err) {
    // Some mobile browsers (like Android Chrome in certain contexts) require a ServiceWorker for Notification
    console.warn("[notifications] Failed to create native Notification:", err);
    return false;
  }
}
