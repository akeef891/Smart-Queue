"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  callNextTicket,
  cancelTicket,
  completeTicket,
  startServingTicket,
} from "@/lib/actions/ticket";

type TicketRow = {
  id: string;
  customerName: string;
  tokenLabel: string;
  status: string;
};

export function QueueLivePanel({
  businessId,
  queueId,
  currentlyServing,
  currentlyCalled,
  waiting,
}: {
  businessId: string;
  queueId: string;
  currentlyServing: TicketRow | null;
  currentlyCalled: TicketRow | null;
  waiting: TicketRow[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [locked, setLocked] = useState(false);
  const [action, setAction] = useState<string | null>(null);

  const busy = pending || locked;

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
      router.refresh();
    });
  }

  const current = currentlyServing ?? currentlyCalled;

  return (
    <section className="mt-6 rounded-xl border bg-white p-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-base font-semibold">Now serving</h3>
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
              onClick={() => {
                if (!window.confirm("Cancel this ticket?")) return;
                run("Cancelling...", () =>
                  cancelTicket({ businessId, queueId, ticketId: current.id })
                );
              }}
              className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            >
              {action === "Cancelling..." ? "Cancelling..." : "Cancel"}
            </button>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-sm text-slate-500">No customer is being served right now.</p>
      )}

      <h4 className="mt-6 text-sm font-semibold">Waiting ({waiting.length})</h4>
      {waiting.length === 0 ? (
        <p className="mt-2 text-sm text-slate-500">No one is waiting.</p>
      ) : (
        <ul className="mt-2 divide-y rounded-lg border">
          {waiting.map((ticket) => (
            <li key={ticket.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
              <span>
                <span className="font-medium">{ticket.tokenLabel}</span>
                <span className="text-slate-600"> · {ticket.customerName}</span>
              </span>
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  if (!window.confirm(`Cancel ${ticket.tokenLabel}?`)) return;
                  run("Cancelling...", () =>
                    cancelTicket({ businessId, queueId, ticketId: ticket.id })
                  );
                }}
                className="text-red-700 hover:underline disabled:opacity-50"
              >
                Cancel
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
