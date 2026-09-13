"use client";

import { useCallback, useState, useTransition } from "react";
import {
  getPublicTicketSnapshot,
  leaveQueue,
  type PublicTicketSnapshot,
} from "@/lib/actions/ticket";
import { useQueueRealtime } from "@/hooks/use-queue-realtime";
import { useTicketNotifications } from "@/hooks/use-ticket-notifications";
import { LiveStatus } from "@/components/live-status";
import { NotificationPermissionControl } from "@/components/customer/notification-permission-control";
import { InPageNotificationBanner } from "@/components/customer/in-page-notification-banner";
import { Bell } from "lucide-react";

export type { PublicTicketSnapshot };

const STATUS_LABELS: Record<string, string> = {
  WAITING: "Waiting",
  CALLED: "You're being called",
  SERVING: "Now being served",
  COMPLETED: "Completed",
  SKIPPED: "Skipped",
  CANCELLED: "Cancelled",
  NO_SHOW: "Marked as no-show",
};

export function LiveTicketView({
  businessId,
  queueId,
  trackingToken,
  initial,
}: {
  businessId: string;
  queueId: string;
  trackingToken: string;
  initial: PublicTicketSnapshot;
}) {
  const [ticket, setTicket] = useState(initial);
  const [leaveOpen, setLeaveOpen] = useState(false);
  const [leaveError, setLeaveError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [locked, setLocked] = useState(false);

  const refresh = useCallback(() => {
    void getPublicTicketSnapshot(businessId, queueId, trackingToken).then((result) => {
      if ("snapshot" in result && result.snapshot) {
        setTicket(result.snapshot);
      }
    });
  }, [businessId, queueId, trackingToken]);

  const liveStatus = useQueueRealtime(queueId, refresh);
  const { permission, requestPermission, notifications, dismissNotification } =
    useTicketNotifications({
      ticket,
      trackingToken,
    });

  const statusLabel = STATUS_LABELS[ticket.status] ?? ticket.status;
  const canLeave =
    (ticket.status === "WAITING" || ticket.status === "CALLED") &&
    ticket.allowCustomerLeave !== false;
  const busy = pending || locked;

  function confirmLeave() {
    if (busy || !canLeave) return;
    setLeaveError(null);
    setLocked(true);
    startTransition(async () => {
      const result = await leaveQueue({ businessId, queueId, trackingToken });
      if ("error" in result && result.error) {
        setLocked(false);
        setLeaveError(result.error);
        return;
      }
      setLeaveOpen(false);
      setLocked(false);
      refresh();
    });
  }

  return (
    <>
      {ticket.enableNotifications !== false ? (
        <InPageNotificationBanner
          notifications={notifications}
          onDismiss={dismissNotification}
        />
      ) : null}

      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10 text-center">
        <div className="flex items-center justify-between">
          <LiveStatus status={liveStatus} />
          {ticket.enableNotifications !== false ? (
            <NotificationPermissionControl
              permission={permission}
              onRequestPermission={requestPermission}
            />
          ) : null}
        </div>

        {ticket.logoUrl ? (
          <div className="mt-4 flex flex-col items-center">
            <div className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
              <img
                src={ticket.logoUrl}
                alt={`${ticket.businessName} logo`}
                className="max-h-full max-w-full object-contain"
              />
            </div>
            <p className="mt-2 text-sm font-semibold text-slate-800">{ticket.businessName}</p>
            <p className="text-xs text-slate-500">{ticket.queueName}</p>
          </div>
        ) : (
          <>
            <p className="mt-4 text-sm font-medium uppercase tracking-wide text-slate-400">
              Your Queue Ticket
            </p>
            <p className="mt-3 text-sm text-slate-500">{ticket.businessName}</p>
            <p className="text-base font-medium">{ticket.queueName}</p>
          </>
        )}

        <p className="mt-8 text-xs uppercase tracking-wide text-slate-400">Ticket</p>
        <p className="text-5xl font-bold tracking-tight">{ticket.label}</p>

        <p className="mt-6 text-xs uppercase tracking-wide text-slate-400">Status</p>
        <p className="mt-1 text-lg font-semibold">{statusLabel}</p>

        {ticket.status === "WAITING" ? (
          <>
            <div className="mt-3 flex flex-col items-center gap-1.5">
              <p className="text-sm text-slate-600">
                {ticket.peopleAhead === 0
                  ? "You're next in line."
                  : ticket.peopleAhead === 1
                    ? "1 person ahead of you."
                    : `${ticket.peopleAhead} people ahead of you.`}
              </p>
              {ticket.peopleAhead === 0 ? (
                <span className="rounded-full bg-blue-50 border border-blue-200 px-3 py-0.5 text-xs font-semibold text-blue-700">
                  ⭐ You&apos;re next in line!
                </span>
              ) : ticket.peopleAhead <= 2 ? (
                <span className="rounded-full bg-amber-50 border border-amber-200 px-3 py-0.5 text-xs font-semibold text-amber-700">
                  ⚡ You&apos;re almost up!
                </span>
              ) : null}
            </div>

            <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
              <div className="rounded-lg border bg-white p-4">
                <p className="text-slate-500">People Ahead</p>
                <p className="mt-1 text-2xl font-semibold">{ticket.peopleAhead}</p>
              </div>
              <div className="rounded-lg border bg-white p-4">
                <p className="text-slate-500">Position</p>
                <p className="mt-1 text-2xl font-semibold">{ticket.position}</p>
              </div>
            </div>

            {ticket.currentlyServingLabel || ticket.currentlyCalledLabel ? (
              <div className="mt-4 rounded-lg border bg-white p-4 text-sm">
                {ticket.currentlyServingLabel ? (
                  <p>
                    <span className="text-slate-500">Now serving</span>
                    <span className="mt-1 block text-lg font-semibold">
                      {ticket.currentlyServingLabel}
                    </span>
                  </p>
                ) : null}
                {ticket.currentlyCalledLabel ? (
                  <p className={ticket.currentlyServingLabel ? "mt-3" : undefined}>
                    <span className="text-slate-500">Now called</span>
                    <span className="mt-1 block text-lg font-semibold">
                      {ticket.currentlyCalledLabel}
                    </span>
                  </p>
                ) : null}
              </div>
            ) : null}
          </>
        ) : null}

        {ticket.status === "CALLED" ? (
          <div className="mt-8 rounded-xl border-2 border-amber-400 bg-amber-50 p-5 text-center shadow-md animate-pulse">
            <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-amber-500 text-white">
              <Bell className="h-5 w-5" />
            </div>
            <p className="mt-3 text-lg font-bold text-amber-950">Your turn is now!</p>
            <p className="mt-1 text-sm font-semibold text-amber-900">
              Ticket {ticket.label} — {ticket.queueName}
            </p>
            <p className="mt-2 text-sm text-amber-800">
              Please proceed to the service counter immediately.
            </p>
          </div>
        ) : null}

        {ticket.status === "SERVING" ? (
          <div className="mt-8 rounded-xl border border-slate-200 bg-slate-100 px-4 py-4 text-center">
            <p className="text-base font-semibold text-slate-800">
              Your service has started.
            </p>
            <p className="mt-1 text-xs text-slate-600">
              You are currently being served at the counter.
            </p>
          </div>
        ) : null}

        {ticket.status === "COMPLETED" ? (
          <div className="mt-8 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-4 text-center">
            <p className="text-base font-semibold text-emerald-900">
              Your service is complete.
            </p>
            <p className="mt-1 text-xs text-emerald-700">Thank you for your visit.</p>
          </div>
        ) : null}

        {ticket.status === "CANCELLED" ? (
          <div className="mt-8 rounded-xl border bg-white px-4 py-4 text-center">
            <p className="text-base font-semibold text-slate-800">
              You have left the queue. This ticket is cancelled.
            </p>
          </div>
        ) : null}

        {ticket.status === "SKIPPED" ? (
          <div className="mt-8 rounded-xl border bg-white px-4 py-3 text-center">
            <p className="text-sm font-medium text-slate-700">This ticket was skipped.</p>
            <p className="mt-1 text-xs text-slate-500">
              Please speak with staff if you are still present.
            </p>
          </div>
        ) : null}

        {ticket.status === "NO_SHOW" ? (
          <div className="mt-8 rounded-xl border bg-white px-4 py-3 text-center">
            <p className="text-sm font-medium text-slate-700">
              This ticket was marked as no-show.
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Please speak with staff to request a new ticket.
            </p>
          </div>
        ) : null}

        {canLeave ? (
          <div className="mt-8">
            {leaveOpen ? (
              <div className="rounded-lg border bg-white p-4 text-left">
                <p className="font-semibold text-slate-900">Leave this queue?</p>
                <p className="mt-2 text-sm text-slate-600">
                  Your current ticket will be cancelled. You will lose your place in line.
                </p>
                {leaveError ? (
                  <p className="mt-3 text-sm text-red-600" role="alert">
                    {leaveError}
                  </p>
                ) : null}
                <div className="mt-4 flex gap-3">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={confirmLeave}
                    className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    {busy ? "Leaving..." : "Leave Queue"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => {
                      if (busy) return;
                      setLeaveOpen(false);
                      setLeaveError(null);
                    }}
                    className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
                  >
                    Stay
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setLeaveError(null);
                  setLeaveOpen(true);
                }}
                className="text-sm text-slate-500 underline hover:text-slate-800 disabled:opacity-50"
              >
                Leave Queue
              </button>
            )}
          </div>
        ) : null}
      </div>
    </>
  );
}
