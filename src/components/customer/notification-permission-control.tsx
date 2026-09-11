"use client";

import { useState } from "react";
import type { BrowserPermissionState } from "@/lib/notifications";
import { Bell, BellOff, Check, Loader2 } from "lucide-react";

export function NotificationPermissionControl({
  permission,
  onRequestPermission,
}: {
  permission: BrowserPermissionState;
  onRequestPermission: () => Promise<BrowserPermissionState>;
}) {
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    if (loading) return;
    setLoading(true);
    try {
      await onRequestPermission();
    } finally {
      setLoading(false);
    }
  }

  if (permission === "granted") {
    return (
      <div className="inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-1 text-xs font-medium text-emerald-700">
        <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
        <span>✓ Notifications Enabled</span>
      </div>
    );
  }

  if (permission === "denied") {
    return (
      <div className="inline-flex items-center justify-center gap-1.5 rounded-md border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-500">
        <BellOff className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
        <span>Notifications are blocked in your browser settings.</span>
      </div>
    );
  }

  if (permission === "unsupported") {
    return (
      <p className="text-xs text-slate-400">
        Browser notifications aren&apos;t supported on this device.
      </p>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center justify-center gap-2 rounded-md border border-slate-200 bg-white px-3.5 py-1.5 text-xs font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 hover:text-slate-900 active:scale-[0.99] disabled:opacity-60"
      aria-label="Enable browser notifications for queue status"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-slate-500" />
      ) : (
        <Bell className="h-3.5 w-3.5 text-slate-500" />
      )}
      <span>Enable Notifications</span>
    </button>
  );
}
