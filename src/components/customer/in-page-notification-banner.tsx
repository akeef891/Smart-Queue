"use client";

import type { CustomerNotification } from "@/lib/notifications";
import { AlertCircle, Bell, CheckCircle2, Clock, X } from "lucide-react";

export function InPageNotificationBanner({
  notifications,
  onDismiss,
}: {
  notifications: CustomerNotification[];
  onDismiss: (id: string) => void;
}) {
  if (notifications.length === 0) return null;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 top-4 z-50 mx-auto flex max-w-md flex-col gap-2 px-4"
      aria-live="assertive"
    >
      {notifications.map((notif) => {
        const isCalled = notif.category === "CALLED";
        const isSuccess = notif.category === "COMPLETED";

        return (
          <div
            key={notif.id}
            role="alert"
            className={`pointer-events-auto flex items-start gap-3 rounded-xl border p-4 shadow-lg transition-all duration-300 animate-in fade-in slide-in-from-top-4 ${isCalled
                ? "border-amber-400 bg-amber-50/95 text-amber-950 shadow-amber-500/10 ring-2 ring-amber-400/50"
                : isSuccess
                  ? "border-emerald-300 bg-emerald-50/95 text-emerald-950 shadow-emerald-500/10"
                  : "border-slate-200 bg-white/95 text-slate-900 shadow-slate-900/10 backdrop-blur-sm"
              }`}
          >
            <div className="mt-0.5 shrink-0">
              {isCalled ? (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-amber-500 text-white animate-pulse">
                  <Bell className="h-4 w-4" />
                </div>
              ) : isSuccess ? (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-emerald-600 text-white">
                  <CheckCircle2 className="h-4 w-4" />
                </div>
              ) : notif.category === "ALMOST_UP" || notif.category === "NEXT_IN_LINE" ? (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white">
                  <Clock className="h-4 w-4" />
                </div>
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-600 text-white">
                  <AlertCircle className="h-4 w-4" />
                </div>
              )}
            </div>

            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-semibold leading-tight">{notif.title}</p>
              <p className="mt-1 text-xs text-slate-600 leading-normal">{notif.message}</p>
            </div>

            <button
              type="button"
              onClick={() => onDismiss(notif.id)}
              className="shrink-0 rounded-md p-1 text-slate-400 hover:bg-black/5 hover:text-slate-700"
              aria-label="Dismiss notification"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        );
      })}
    </div>
  );
}
