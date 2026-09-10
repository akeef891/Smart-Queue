"use client";

import { useCallback, useState } from "react";
import { getQueueAnalytics, type QueueAnalyticsSnapshot } from "@/lib/actions/analytics";
import { useQueueRealtime } from "@/hooks/use-queue-realtime";
import { LiveStatus } from "@/components/live-status";

function formatAnalyticsDuration(ms: number | null) {
  if (ms == null) return "—";
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return "<1 min";
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

function MetricCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

const STATUS_ROWS: { key: keyof QueueAnalyticsSnapshot; label: string }[] = [
  { key: "completed", label: "Completed" },
  { key: "cancelled", label: "Cancelled" },
  { key: "waiting", label: "Waiting" },
  { key: "called", label: "Called" },
  { key: "serving", label: "Serving" },
  { key: "skipped", label: "Skipped" },
  { key: "noShow", label: "No-show" },
];

export function QueueAnalyticsView({
  businessId,
  queueId,
  initial,
}: {
  businessId: string;
  queueId: string;
  initial: QueueAnalyticsSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void getQueueAnalytics(businessId, queueId).then((result) => {
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("snapshot" in result && result.snapshot) {
        setError(null);
        setSnapshot(result.snapshot);
      }
    });
  }, [businessId, queueId]);

  const liveStatus = useQueueRealtime(queueId, refresh);
  const empty = snapshot.totalCustomers === 0;
  const total = snapshot.totalCustomers;

  return (
    <div className="mt-6 space-y-6">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-slate-500">{snapshot.rangeLabel}</p>
        <LiveStatus status={liveStatus} />
      </div>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      {empty ? (
        <section className="rounded-xl border bg-white p-6">
          <p className="font-semibold">No queue activity today.</p>
          <p className="mt-2 text-sm text-slate-500">
            Analytics will appear here once customers start using this queue.
          </p>
        </section>
      ) : null}

      <section>
        <h3 className="text-base font-semibold">Overview</h3>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <MetricCard label="Total Customers" value={empty ? "—" : snapshot.totalCustomers} />
          <MetricCard label="Completed" value={empty ? "—" : snapshot.completed} />
          <MetricCard label="Cancelled" value={empty ? "—" : snapshot.cancelled} />
          <MetricCard label="Waiting" value={empty ? "—" : snapshot.waiting} />
          <MetricCard label="Called" value={empty ? "—" : snapshot.called} />
          <MetricCard label="Serving" value={empty ? "—" : snapshot.serving} />
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6">
        <h3 className="text-base font-semibold">Queue Performance</h3>
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Average waiting time</p>
            <p className="mt-1 text-xl font-semibold">{formatAnalyticsDuration(snapshot.avgWaitMs)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Average service time</p>
            <p className="mt-1 text-xl font-semibold">{formatAnalyticsDuration(snapshot.avgServiceMs)}</p>
          </div>
          <div>
            <p className="text-xs uppercase tracking-wide text-slate-400">Completion rate</p>
            <p className="mt-1 text-xl font-semibold">
              {snapshot.completionRate == null ? "—" : `${snapshot.completionRate}%`}
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-xl border bg-white p-6">
        <h3 className="text-base font-semibold">Status Breakdown</h3>
        <ul className="mt-4 space-y-3">
          {STATUS_ROWS.map((row) => {
            const count = snapshot[row.key] as number;
            const percent = total > 0 ? Math.round((count / total) * 100) : null;
            return (
              <li key={row.key}>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-slate-600">{row.label}</span>
                  <span className="font-medium">
                    {empty ? "—" : count}
                    {percent == null ? "" : ` · ${percent}%`}
                  </span>
                </div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full rounded-full bg-slate-900"
                    style={{ width: `${percent ?? 0}%` }}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
