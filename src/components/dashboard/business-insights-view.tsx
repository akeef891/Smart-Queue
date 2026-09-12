"use client";

import { useCallback, useMemo, useState, useTransition } from "react";
import Link from "next/link";
import {
  getBusinessInsights,
  type BusinessInsightsSnapshot,
} from "@/lib/actions/insights";
import type { AnalyticsPeriod } from "@/lib/analytics-range";
import { useBusinessQueuesRealtime } from "@/hooks/use-business-queues-realtime";
import { LiveStatus } from "@/components/live-status";
import {
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  Clock,
  HelpCircle,
  Info,
  Layers,
  RefreshCw,
  TrendingUp,
  UserCheck,
  UserX,
  Users,
} from "lucide-react";

function formatDuration(ms: number | null): string {
  if (ms == null) return "—";
  const totalMinutes = Math.round(ms / 60000);
  if (totalMinutes < 1) return "<1 min";
  if (totalMinutes < 60) return `${totalMinutes} min`;
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return `${hours}h ${String(minutes).padStart(2, "0")}m`;
}

const PERIOD_OPTIONS: { id: AnalyticsPeriod; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "yesterday", label: "Yesterday" },
  { id: "last7days", label: "Last 7 Days" },
  { id: "last30days", label: "Last 30 Days" },
];

export function BusinessInsightsView({
  businessId,
  initial,
}: {
  businessId: string;
  initial: BusinessInsightsSnapshot;
}) {
  const [snapshot, setSnapshot] = useState<BusinessInsightsSnapshot>(initial);
  const [period, setPeriod] = useState<AnalyticsPeriod>(initial.period);
  const [selectedQueueId, setSelectedQueueId] = useState<string>(
    initial.selectedQueueId ?? "ALL"
  );
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const loadData = useCallback(
    (newPeriod: AnalyticsPeriod, queueIdVal: string) => {
      startTransition(async () => {
        const queueParam = queueIdVal === "ALL" ? undefined : queueIdVal;
        const res = await getBusinessInsights(businessId, {
          period: newPeriod,
          queueId: queueParam,
        });

        if (res.error) {
          setError(res.error);
        } else if (res.snapshot) {
          setError(null);
          setSnapshot(res.snapshot);
        }
      });
    },
    [businessId]
  );

  const handlePeriodChange = (newPeriod: AnalyticsPeriod) => {
    setPeriod(newPeriod);
    loadData(newPeriod, selectedQueueId);
  };

  const handleQueueChange = (newQueueId: string) => {
    setSelectedQueueId(newQueueId);
    loadData(period, newQueueId);
  };

  // Realtime subscription across active queues
  const targetQueueIds = useMemo(() => {
    if (selectedQueueId !== "ALL") {
      return [selectedQueueId];
    }
    return snapshot.queues.map((q) => q.id);
  }, [selectedQueueId, snapshot.queues]);

  const liveStatus = useBusinessQueuesRealtime(
    targetQueueIds,
    useCallback(() => {
      loadData(period, selectedQueueId);
    }, [loadData, period, selectedQueueId])
  );

  const hasNoData = snapshot.totalCustomers === 0 && snapshot.liveWaiting === 0;

  return (
    <div className="space-y-6">
      {/* Top Filter and Controls Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between rounded-xl border bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          {/* Period Selector Dropdown */}
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-slate-400" />
            <select
              aria-label="Select time period"
              value={period}
              disabled={isPending}
              onChange={(e) => handlePeriodChange(e.target.value as AnalyticsPeriod)}
              className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.id} value={opt.id}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>

          {/* Queue Filter Dropdown */}
          {snapshot.queues.length > 0 && (
            <div className="flex items-center gap-2">
              <Layers className="h-4 w-4 text-slate-400" />
              <select
                aria-label="Filter by queue"
                value={selectedQueueId}
                disabled={isPending}
                onChange={(e) => handleQueueChange(e.target.value)}
                className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-800 shadow-sm transition hover:border-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900"
              >
                <option value="ALL">All Queues ({snapshot.queues.length})</option>
                {snapshot.queues.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>

        {/* Realtime Status & Refresh */}
        <div className="flex items-center gap-3 self-end sm:self-auto">
          <LiveStatus status={liveStatus} />
          <button
            type="button"
            onClick={() => loadData(period, selectedQueueId)}
            disabled={isPending}
            className="flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium text-slate-600 shadow-sm transition hover:bg-slate-50 disabled:opacity-50"
            title="Refresh analytics data"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isPending ? "animate-spin" : ""}`} />
            <span>{isPending ? "Refreshing…" : "Refresh"}</span>
          </button>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700" role="alert">
          {error}
        </div>
      ) : null}

      {/* Subtle Wait Time Warning Alert */}
      {snapshot.isWaitTimeHigh && snapshot.waitTimeWarningText ? (
        <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50/80 p-4 text-amber-900 shadow-sm">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <div className="text-sm">
            <p className="font-semibold text-amber-800">Wait times are higher than usual</p>
            <p className="mt-0.5 text-amber-700">{snapshot.waitTimeWarningText}</p>
          </div>
        </div>
      ) : null}

      {/* Empty State when no activity is present */}
      {hasNoData ? (
        <div className="rounded-xl border bg-white p-8 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500">
            <BarChart3 className="h-6 w-6" />
          </div>
          <h3 className="mt-4 text-base font-semibold text-slate-900">No queue data yet</h3>
          <p className="mx-auto mt-1 max-w-md text-sm text-slate-500">
            Once customers start using your queue during {snapshot.periodLabel.toLowerCase()}, business insights,
            hourly volume, peak times, and completion rates will appear here.
          </p>
          <div className="mt-5 flex justify-center gap-3">
            <Link
              href={`/businesses/${businessId}`}
              className="rounded-lg border bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
            >
              Manage Queues
            </Link>
          </div>
        </div>
      ) : null}

      {/* KPI Cards Grid */}
      <section aria-labelledby="kpi-heading">
        <div className="flex items-center justify-between">
          <h2 id="kpi-heading" className="text-base font-semibold text-slate-900">
            Key Performance Metrics
          </h2>
          <span className="text-xs text-slate-500">
            Period: {snapshot.periodLabel}
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* 1. Customers Served */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium uppercase tracking-wider">Customers Served</span>
              <UserCheck className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {snapshot.customersServed}
            </p>
            <div className="mt-2 flex items-center text-xs">
              {snapshot.servedTrend.diffPercent != null ? (
                <span
                  className={`inline-flex items-center font-medium ${
                    snapshot.servedTrend.direction === "up"
                      ? "text-emerald-700"
                      : snapshot.servedTrend.direction === "down"
                      ? "text-rose-600"
                      : "text-slate-500"
                  }`}
                >
                  {snapshot.servedTrend.direction === "up" && <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />}
                  {snapshot.servedTrend.direction === "down" && <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />}
                  {snapshot.servedTrend.text}
                </span>
              ) : (
                <span className="text-slate-400">vs. {snapshot.comparisonLabel}</span>
              )}
            </div>
          </div>

          {/* 2. Currently Waiting (Realtime) */}
          <div className="rounded-xl border bg-white p-4 shadow-sm ring-1 ring-slate-900/5">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium uppercase tracking-wider">Currently Waiting</span>
              <div className="flex items-center gap-1.5">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500"></span>
                </span>
                <Users className="h-4 w-4 text-slate-400" />
              </div>
            </div>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {snapshot.liveWaiting}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {snapshot.liveServing > 0 ? `${snapshot.liveServing} serving now` : "Live real-time count"}
              {snapshot.liveCalled > 0 ? ` · ${snapshot.liveCalled} called` : ""}
            </p>
          </div>

          {/* 3. Average Wait Time */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium uppercase tracking-wider">Avg. Wait Time</span>
              <Clock className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {formatDuration(snapshot.avgWaitMs)}
            </p>
            <div className="mt-2 flex items-center text-xs">
              {snapshot.waitTrend.diffPercent != null ? (
                <span
                  className={`inline-flex items-center font-medium ${
                    snapshot.waitTrend.direction === "down"
                      ? "text-emerald-700"
                      : snapshot.waitTrend.direction === "up"
                      ? "text-rose-600"
                      : "text-slate-500"
                  }`}
                >
                  {snapshot.waitTrend.direction === "up" && <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />}
                  {snapshot.waitTrend.direction === "down" && <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />}
                  {snapshot.waitTrend.text}
                </span>
              ) : (
                <span className="text-slate-400">From join to call/service</span>
              )}
            </div>
          </div>

          {/* 4. Average Service Time */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium uppercase tracking-wider">Avg. Service Time</span>
              <CheckCircle2 className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-2 text-3xl font-bold tracking-tight text-slate-900">
              {formatDuration(snapshot.avgServiceMs)}
            </p>
            <div className="mt-2 flex items-center text-xs">
              {snapshot.serviceTrend.diffPercent != null ? (
                <span
                  className={`inline-flex items-center font-medium ${
                    snapshot.serviceTrend.direction === "up"
                      ? "text-slate-700"
                      : snapshot.serviceTrend.direction === "down"
                      ? "text-slate-700"
                      : "text-slate-500"
                  }`}
                >
                  {snapshot.serviceTrend.direction === "up" && <ArrowUpRight className="mr-0.5 h-3.5 w-3.5" />}
                  {snapshot.serviceTrend.direction === "down" && <ArrowDownRight className="mr-0.5 h-3.5 w-3.5" />}
                  {snapshot.serviceTrend.text}
                </span>
              ) : (
                <span className="text-slate-400">Service start to completion</span>
              )}
            </div>
          </div>
        </div>

        {/* Secondary KPI Cards */}
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-3">
          {/* 5. Total Customers */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium uppercase tracking-wider">Total Customers</span>
              <Users className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              {snapshot.totalCustomers}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {snapshot.totalCustomersTrend.diffPercent != null
                ? snapshot.totalCustomersTrend.text
                : "Active or joined in period"}
            </p>
          </div>

          {/* 6. Completion Rate */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <div className="flex items-center gap-1">
                <span className="text-xs font-medium uppercase tracking-wider">Completion Rate</span>
                <span title="Completed tickets divided by all tickets that reached a terminal outcome (completed, skipped, cancelled, no-show)">
                  <HelpCircle className="h-3 w-3 text-slate-400" />
                </span>
              </div>
              <TrendingUp className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              {snapshot.completionRate == null ? "—" : `${snapshot.completionRate}%`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {snapshot.completionRateTrend.diffPercent != null
                ? snapshot.completionRateTrend.text
                : "Completed ÷ terminal tickets"}
            </p>
          </div>

          {/* 7. Skipped / No-show Count */}
          <div className="rounded-xl border bg-white p-4 shadow-sm">
            <div className="flex items-center justify-between text-slate-500">
              <span className="text-xs font-medium uppercase tracking-wider">Skipped / No-Show</span>
              <UserX className="h-4 w-4 text-slate-400" />
            </div>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-900">
              {snapshot.skippedOrNoShowCount}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              {snapshot.skippedCount} skipped · {snapshot.noShowCount} no-show
            </p>
          </div>
        </div>
      </section>

      {/* Business Insights & Observations (Deterministic Rules) */}
      <section className="rounded-xl border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="rounded-md bg-slate-900 p-1.5 text-white">
            <TrendingUp className="h-4 w-4" />
          </div>
          <h2 className="text-base font-semibold text-slate-900">Business Observations</h2>
        </div>
        <p className="mt-1 text-sm text-slate-500">
          Deterministic takeaways generated from today&apos;s queue traffic and historical benchmarks.
        </p>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {snapshot.insights.map((insight) => (
            <div
              key={insight.id}
              className={`flex items-start gap-3 rounded-lg border p-3.5 text-sm ${
                insight.type === "warning"
                  ? "border-amber-200 bg-amber-50/50"
                  : insight.type === "positive"
                  ? "border-emerald-200 bg-emerald-50/40"
                  : "border-slate-200 bg-slate-50/60"
              }`}
            >
              {insight.type === "warning" ? (
                <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              ) : insight.type === "positive" ? (
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
              )}
              <div>
                <p className="font-medium text-slate-900">{insight.title}</p>
                <p className="mt-0.5 text-slate-600">{insight.description}</p>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Volume Chart & Peak Hours Grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Customer Volume Chart (2 columns on large) */}
        <section className="rounded-xl border bg-white p-6 shadow-sm lg:col-span-2">
          <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-base font-semibold text-slate-900">Queue Volume Over Time</h2>
              <p className="text-xs text-slate-500">
                {snapshot.chartType === "hourly"
                  ? `Hourly customer volume for ${snapshot.periodLabel.toLowerCase()}`
                  : `Daily customer volume across the ${snapshot.periodLabel.toLowerCase()}`}
              </p>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-900"></span>
                Completed
              </span>
              <span className="flex items-center gap-1">
                <span className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-200"></span>
                Other entries
              </span>
            </div>
          </div>

          {/* Volume Bars */}
          <div className="mt-6">
            {snapshot.chartBuckets.length === 0 ||
            snapshot.chartBuckets.every((b) => b.totalEntries === 0) ? (
              <div className="flex h-44 items-center justify-center rounded-lg border border-dashed text-sm text-slate-400">
                No activity recorded during this time window.
              </div>
            ) : (
              <div>
                {/* Max value for scale */}
                {(() => {
                  const maxEntries = Math.max(
                    ...snapshot.chartBuckets.map((b) => b.totalEntries),
                    1
                  );
                  return (
                    <div className="relative">
                      {/* Bar columns */}
                      <div className="flex h-48 items-end gap-1.5 overflow-x-auto pb-6 pt-2">
                        {snapshot.chartBuckets.map((b) => {
                          const heightPct = Math.max(
                            Math.round((b.totalEntries / maxEntries) * 100),
                            b.totalEntries > 0 ? 8 : 0
                          );
                          const servedPct =
                            b.totalEntries > 0
                              ? Math.round((b.servedCount / b.totalEntries) * 100)
                              : 0;

                          return (
                            <div
                              key={b.key}
                              className="group relative flex min-w-[20px] flex-1 flex-col items-center justify-end h-full"
                            >
                              {/* Hover Tooltip */}
                              <div className="pointer-events-none absolute bottom-full mb-2 hidden rounded-md bg-slate-900 px-2 py-1 text-center text-xs text-white shadow-lg group-hover:block z-20 whitespace-nowrap">
                                <p className="font-semibold">{b.label}</p>
                                <p className="text-slate-300">
                                  {b.servedCount} served / {b.totalEntries} entries
                                </p>
                              </div>

                              {/* Bar container */}
                              <div
                                style={{ height: `${heightPct}%` }}
                                className={`w-full rounded-t transition-all ${
                                  b.isPeak
                                    ? "bg-slate-900 ring-2 ring-slate-400"
                                    : "bg-slate-200 hover:bg-slate-300"
                                } overflow-hidden flex flex-col justify-end`}
                              >
                                {/* Portion that represents served */}
                                {b.servedCount > 0 && (
                                  <div
                                    style={{ height: `${servedPct}%` }}
                                    className="w-full bg-slate-800"
                                  />
                                )}
                              </div>

                              {/* X-axis Label */}
                              <span
                                className={`absolute top-full mt-1 text-[10px] ${
                                  b.isPeak ? "font-bold text-slate-900" : "text-slate-400"
                                } truncate max-w-full`}
                                title={b.label}
                              >
                                {b.subLabel ?? b.label}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })()}
              </div>
            )}
          </div>
        </section>

        {/* Peak Hours & Outcomes Column */}
        <div className="space-y-6">
          {/* Peak Hours Card */}
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Peak Hours</h2>
            <p className="text-xs text-slate-500">Highest volume window during period</p>

            <div className="mt-4 rounded-xl border bg-slate-50 p-4">
              {snapshot.peakHours ? (
                <>
                  <p className="text-xs font-medium uppercase tracking-wider text-slate-400">
                    Busiest Window
                  </p>
                  <p className="mt-1 text-xl font-bold text-slate-900">
                    {snapshot.peakHours.timeWindow}
                  </p>
                  <dl className="mt-3 grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <dt className="text-slate-500">Customers served</dt>
                      <dd className="font-semibold text-slate-800">
                        {snapshot.peakHours.customersServed}
                      </dd>
                    </div>
                    <div>
                      <dt className="text-slate-500">Total entries</dt>
                      <dd className="font-semibold text-slate-800">
                        {snapshot.peakHours.totalEntries}
                      </dd>
                    </div>
                  </dl>
                </>
              ) : (
                <div className="py-2 text-center text-sm text-slate-500">
                  <Clock className="mx-auto mb-1 h-5 w-5 text-slate-400" />
                  Not enough data yet
                </div>
              )}
            </div>
          </section>

          {/* Queue Outcomes breakdown */}
          <section className="rounded-xl border bg-white p-6 shadow-sm">
            <h2 className="text-base font-semibold text-slate-900">Queue Outcomes</h2>
            <p className="text-xs text-slate-500">Breakdown of terminal queue tickets</p>

            <div className="mt-4 space-y-3">
              {snapshot.outcomes.map((item) => (
                <div key={item.status} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium text-slate-700">{item.label}</span>
                    <span className="text-slate-500">
                      {item.count} ({item.percentage}%)
                    </span>
                  </div>
                  <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                    <div
                      style={{ width: `${item.percentage}%` }}
                      className={`h-full rounded-full ${
                        item.status === "COMPLETED"
                          ? "bg-emerald-600"
                          : item.status === "SKIPPED"
                          ? "bg-amber-500"
                          : item.status === "CANCELLED"
                          ? "bg-rose-500"
                          : "bg-slate-400"
                      }`}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>

      {/* Multi-Queue Summary Table (when All Queues selected and business has multiple queues) */}
      {selectedQueueId === "ALL" && snapshot.queues.length > 1 && (
        <section className="rounded-xl border bg-white p-6 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">Queues Overview</h2>
          <p className="text-xs text-slate-500">Configured queues within this business</p>

          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b bg-slate-50 text-xs font-medium text-slate-500 uppercase tracking-wider">
                <tr>
                  <th className="px-4 py-3">Queue Name</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Avg. Service</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {snapshot.queues.map((q) => (
                  <tr key={q.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-medium text-slate-900">{q.name}</td>
                    <td className="px-4 py-3">
                      <span className="rounded-full border px-2.5 py-0.5 text-xs font-medium">
                        {q.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-500">{q.averageServiceTime} min</td>
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => handleQueueChange(q.id)}
                        className="text-xs font-medium text-slate-700 underline hover:text-slate-900"
                      >
                        Filter Insights
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </div>
  );
}
