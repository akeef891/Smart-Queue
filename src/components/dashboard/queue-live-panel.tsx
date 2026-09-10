"use client";

import { useCallback, useState, useTransition } from "react";
import {
  callNextTicket,
  cancelTicket,
  completeTicket,
  getQueueHistory,
  getStaffQueueSnapshot,
  startServingTicket,
  type QueueHistoryRow,
  type StaffQueueSnapshot,
  type StaffTicketRow,
} from "@/lib/actions/ticket";
import { useQueueRealtime } from "@/hooks/use-queue-realtime";
import { LiveStatus } from "@/components/live-status";

function formatJoinedAt(value: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDuration(startIso: string | null, endIso: string | null) {
  if (!startIso || !endIso) return "—";
  const start = new Date(startIso).getTime();
  const end = new Date(endIso).getTime();
  if (Number.isNaN(start) || Number.isNaN(end) || end < start) return "—";
  const totalSeconds = Math.round((end - start) / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes === 0) return `${seconds}s`;
  if (seconds === 0) return `${minutes}m`;
  return `${minutes}m ${seconds}s`;
}

const HISTORY_FILTERS = [
  { id: "ALL", label: "All" },
  { id: "COMPLETED", label: "Completed" },
  { id: "CANCELLED", label: "Cancelled" },
  { id: "SKIPPED", label: "Skipped" },
  { id: "NO_SHOW", label: "No-show" },
] as const;

type HistoryFilter = (typeof HISTORY_FILTERS)[number]["id"];

export function QueueLivePanel({
  businessId,
  queueId,
  initial,
  initialHistory,
  initialHistoryError,
}: {
  businessId: string;
  queueId: string;
  initial: StaffQueueSnapshot;
  initialHistory: QueueHistoryRow[];
  initialHistoryError: string | null;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [history, setHistory] = useState(initialHistory);
  const [historyError, setHistoryError] = useState<string | null>(initialHistoryError);
  const [historyFilter, setHistoryFilter] = useState<HistoryFilter>("ALL");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [locked, setLocked] = useState(false);
  const [action, setAction] = useState<string | null>(null);

  const refreshSnapshot = useCallback(() => {
    void getStaffQueueSnapshot(businessId, queueId).then((result) => {
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("snapshot" in result && result.snapshot) {
        setError(null);
        setSnapshot(result.snapshot);
      }
    });
    void getQueueHistory(businessId, queueId).then((result) => {
      if ("error" in result && result.error) {
        setHistoryError(result.error);
        return;
      }
      if ("history" in result && result.history) {
        setHistoryError(null);
        setHistory(result.history);
      }
    });
  }, [businessId, queueId]);

  const liveStatus = useQueueRealtime(queueId, refreshSnapshot);

  const busy = pending || locked;
  const { currentlyServing, currentlyCalled, waiting, recentlyCompleted, totalServed } = snapshot;
  const current = currentlyServing ?? currentlyCalled;

  function run(label: string, fn: () => Promise<{ error?: string } | { ok?: true; ticketId?: string }>) {
    if (busy) return;
    setError(null);
    setAction(label);
    setLocked(true);
    startTransition(async () => {
      const result = await fn();
      setLocked(false);
      setAction(null);
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      refreshSnapshot();
    });
  }

  function cancel(ticket: StaffTicketRow) {
    if (!window.confirm(`Cancel ${ticket.tokenLabel}?`)) return;
    run("Cancelling...", () => cancelTicket({ businessId, queueId, ticketId: ticket.id }));
  }

  return (
    <>
      <section className="mt-6 rounded-xl border bg-white p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold">Live operations</h3>
          <LiveStatus status={liveStatus} />
        </div>
        <dl className="mt-4 grid grid-cols-2 gap-3 text-sm lg:grid-cols-4">
          <div className="rounded-lg border bg-slate-50 p-3">
            <dt className="text-slate-500">Currently serving</dt>
            <dd className="mt-1 font-semibold">{currentlyServing?.tokenLabel ?? "None"}</dd>
          </div>
          <div className="rounded-lg border bg-slate-50 p-3">
            <dt className="text-slate-500">Called</dt>
            <dd className="mt-1 font-semibold">{currentlyCalled?.tokenLabel ?? "None"}</dd>
          </div>
          <div className="rounded-lg border bg-slate-50 p-3">
            <dt className="text-slate-500">Waiting</dt>
            <dd className="mt-1 font-semibold">{waiting.length}</dd>
          </div>
          <div className="rounded-lg border bg-slate-50 p-3">
            <dt className="text-slate-500">Served</dt>
            <dd className="mt-1 font-semibold">{totalServed}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-6 rounded-xl border bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-base font-semibold">Queue actions</h3>
          <button
            type="button"
            disabled={busy}
            onClick={() => run("Calling...", () => callNextTicket({ businessId, queueId }))}
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {action === "Calling..." ? "Calling..." : "Call Next"}
          </button>
        </div>
        {error ? (
          <p className="mt-3 text-sm text-red-600" role="alert">
            {error}
          </p>
        ) : null}
        {busy ? <p className="mt-2 text-xs text-slate-500">Updating queue…</p> : null}
      </section>

      <section className="mt-6 rounded-xl border bg-white p-6">
        <h3 className="text-base font-semibold">Currently serving</h3>
        {current ? (
          <div className="mt-4 rounded-lg border bg-slate-50 p-4">
            <p className="text-xs uppercase tracking-wide text-slate-500">{current.status}</p>
            <p className="mt-1 text-2xl font-semibold">{current.tokenLabel}</p>
            <p className="text-sm text-slate-600">{current.customerName}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {current.status === "CALLED" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run("Starting...", () =>
                      startServingTicket({ businessId, queueId, ticketId: current.id })
                    )
                  }
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-white disabled:opacity-50"
                >
                  {action === "Starting..." ? "Starting..." : "Start Serving"}
                </button>
              ) : null}
              {current.status === "SERVING" ? (
                <button
                  type="button"
                  disabled={busy}
                  onClick={() =>
                    run("Completing...", () =>
                      completeTicket({ businessId, queueId, ticketId: current.id })
                    )
                  }
                  className="rounded-md border px-3 py-1.5 text-sm hover:bg-white disabled:opacity-50"
                >
                  {action === "Completing..." ? "Completing..." : "Complete"}
                </button>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => cancel(current)}
                className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                {action === "Cancelling..." ? "Cancelling..." : "Cancel"}
              </button>
            </div>
          </div>
        ) : (
          <p className="mt-4 text-sm text-slate-500">No customer is being served right now.</p>
        )}
      </section>

      <section className="mt-6 rounded-xl border bg-white p-6">
        <h3 className="text-base font-semibold">Waiting customers</h3>
        {waiting.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No one is waiting.</p>
        ) : (
          <>
            <ul className="mt-3 divide-y rounded-lg border md:hidden">
              {waiting.map((ticket, index) => (
                <li key={ticket.id} className="flex flex-col gap-2 px-4 py-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="font-semibold">{ticket.tokenLabel}</p>
                      <p className="text-slate-600">{ticket.customerName}</p>
                    </div>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => cancel(ticket)}
                      className="text-red-700 hover:underline disabled:opacity-50"
                    >
                      Cancel
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">
                    Position {index + 1} · {ticket.status} · Joined {formatJoinedAt(ticket.joinedAt)}
                  </p>
                </li>
              ))}
            </ul>
            <div className="mt-3 hidden overflow-x-auto rounded-lg border md:block">
              <table className="w-full min-w-[32rem] text-left text-sm">
                <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-4 py-2 font-medium">Ticket</th>
                    <th className="px-4 py-2 font-medium">Customer</th>
                    <th className="px-4 py-2 font-medium">Position</th>
                    <th className="px-4 py-2 font-medium">Joined</th>
                    <th className="px-4 py-2 font-medium">Status</th>
                    <th className="px-4 py-2 font-medium">
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {waiting.map((ticket, index) => (
                    <tr key={ticket.id}>
                      <td className="px-4 py-3 font-medium">{ticket.tokenLabel}</td>
                      <td className="px-4 py-3 text-slate-600">{ticket.customerName}</td>
                      <td className="px-4 py-3">{index + 1}</td>
                      <td className="px-4 py-3 text-slate-600">{formatJoinedAt(ticket.joinedAt)}</td>
                      <td className="px-4 py-3">{ticket.status}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => cancel(ticket)}
                          className="text-red-700 hover:underline disabled:opacity-50"
                        >
                          Cancel
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      <section className="mt-6 rounded-xl border bg-white p-6">
        <h3 className="text-base font-semibold">Recently completed</h3>
        {recentlyCompleted.length === 0 ? (
          <p className="mt-3 text-sm text-slate-500">No recently completed tickets.</p>
        ) : (
          <ul className="mt-3 divide-y text-sm">
            {recentlyCompleted.map((entry) => (
              <li key={entry.id} className="flex justify-between gap-3 py-2">
                <span>
                  {entry.tokenLabel} · {entry.customerName}
                </span>
                <span className="text-slate-500">COMPLETED</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <QueueHistorySection
        history={history}
        error={historyError}
        filter={historyFilter}
        onFilterChange={setHistoryFilter}
      />
    </>
  );
}

function QueueHistorySection({
  history,
  error,
  filter,
  onFilterChange,
}: {
  history: QueueHistoryRow[];
  error: string | null;
  filter: HistoryFilter;
  onFilterChange: (filter: HistoryFilter) => void;
}) {
  const visible =
    filter === "ALL" ? history : history.filter((row) => row.status === filter);

  return (
    <section className="mt-6 rounded-xl border bg-white p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold">Queue History</h3>
        <div className="flex flex-wrap gap-2">
          {HISTORY_FILTERS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => onFilterChange(item.id)}
              className={
                filter === item.id
                  ? "rounded-full border border-slate-900 bg-slate-900 px-3 py-1 text-xs font-medium text-white"
                  : "rounded-full border px-3 py-1 text-xs font-medium text-slate-600 hover:bg-slate-50"
              }
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
      <p className="mt-2 text-xs text-slate-500">Showing the most recent {history.length} closed tickets for this queue (up to 50).</p>

      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {!error && history.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No queue history yet.</p>
      ) : null}

      {!error && history.length > 0 && visible.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">No matching history.</p>
      ) : null}

      {!error && visible.length > 0 ? (
        <>
          <ul className="mt-3 divide-y rounded-lg border md:hidden">
            {visible.map((row) => (
              <li key={row.id} className="flex flex-col gap-1 px-4 py-3 text-sm">
                <p className="font-semibold">
                  {row.tokenLabel} · {row.customerName}
                </p>
                <p className="text-xs uppercase tracking-wide text-slate-500">{row.status}</p>
                <p className="text-xs text-slate-500">Joined {formatJoinedAt(row.joinedAt)}</p>
                {row.calledAt ? <p className="text-xs text-slate-500">Called {formatJoinedAt(row.calledAt)}</p> : null}
                {row.servingAt ? <p className="text-xs text-slate-500">Serving {formatJoinedAt(row.servingAt)}</p> : null}
                {row.completedAt ? (
                  <p className="text-xs text-slate-500">Completed {formatJoinedAt(row.completedAt)}</p>
                ) : null}
                {row.cancelledAt ? (
                  <p className="text-xs text-slate-500">Cancelled {formatJoinedAt(row.cancelledAt)}</p>
                ) : null}
                <p className="text-xs text-slate-500">
                  Wait {formatDuration(row.joinedAt, row.calledAt)} · Service{" "}
                  {formatDuration(row.servingAt, row.completedAt)}
                </p>
                {row.status === "SKIPPED" || row.status === "NO_SHOW" ? (
                  <p className="text-xs text-slate-400">
                    Last record update {formatJoinedAt(row.updatedAt)} (not an exact skip/no-show time)
                  </p>
                ) : null}
              </li>
            ))}
          </ul>
          <div className="mt-3 hidden overflow-x-auto rounded-lg border md:block">
            <table className="w-full min-w-[56rem] text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-4 py-2 font-medium">Ticket</th>
                  <th className="px-4 py-2 font-medium">Customer</th>
                  <th className="px-4 py-2 font-medium">Status</th>
                  <th className="px-4 py-2 font-medium">Joined</th>
                  <th className="px-4 py-2 font-medium">Called</th>
                  <th className="px-4 py-2 font-medium">Serving</th>
                  <th className="px-4 py-2 font-medium">Completed</th>
                  <th className="px-4 py-2 font-medium">Cancelled</th>
                  <th className="px-4 py-2 font-medium">Wait</th>
                  <th className="px-4 py-2 font-medium">Service</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {visible.map((row) => (
                  <tr key={row.id}>
                    <td className="px-4 py-3 font-medium">{row.tokenLabel}</td>
                    <td className="px-4 py-3 text-slate-600">{row.customerName}</td>
                    <td className="px-4 py-3">
                      <span>{row.status}</span>
                      {row.status === "SKIPPED" || row.status === "NO_SHOW" ? (
                        <span className="mt-1 block text-xs font-normal text-slate-400">
                          Last update {formatJoinedAt(row.updatedAt)} — not an exact event time
                        </span>
                      ) : null}
                    </td>
                    <td className="px-4 py-3 text-slate-600">{formatJoinedAt(row.joinedAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatJoinedAt(row.calledAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatJoinedAt(row.servingAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatJoinedAt(row.completedAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatJoinedAt(row.cancelledAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDuration(row.joinedAt, row.calledAt)}</td>
                    <td className="px-4 py-3 text-slate-600">{formatDuration(row.servingAt, row.completedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
    </section>
  );
}
