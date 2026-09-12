"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedBusinessForUser } from "@/lib/tenant";
import {
  getAnalyticsPeriodRange,
  type AnalyticsPeriod,
  type AnalyticsPeriodResult,
} from "@/lib/analytics-range";
import type { QueueEntryStatus } from "@/generated/prisma";

import {
  WAIT_TIME_WARNING_THRESHOLD_MINUTES,
  type TrendDirection,
  type MetricTrend,
  type QueueOutcomeItem,
  type VolumeChartBucket,
  type PeakHoursInfo,
  type BusinessInsightItem,
  type BusinessInsightsSnapshot,
} from "@/lib/insights-types";

export type {
  TrendDirection,
  MetricTrend,
  QueueOutcomeItem,
  VolumeChartBucket,
  PeakHoursInfo,
  BusinessInsightItem,
  BusinessInsightsSnapshot,
};

function inRange(value: Date | null, start: Date, end: Date) {
  return Boolean(value && value >= start && value < end);
}

function computeTrend(
  current: number | null,
  prev: number | null,
  comparisonLabel: string,
  lowerIsBetter = false
): MetricTrend {
  if (current == null || prev == null || prev === 0) {
    return {
      direction: "flat",
      diffPercent: null,
      text: "No baseline comparison",
    };
  }

  const diff = ((current - prev) / prev) * 100;
  const pct = Math.round(Math.abs(diff));

  if (pct === 0) {
    return {
      direction: "flat",
      diffPercent: 0,
      text: `No change vs ${comparisonLabel.toLowerCase()}`,
    };
  }

  const direction: TrendDirection = diff > 0 ? "up" : "down";
  const sign = diff > 0 ? "↑" : "↓";

  return {
    direction,
    diffPercent: pct,
    text: `${sign} ${pct}% vs ${comparisonLabel.toLowerCase()}`,
  };
}

function getZonedHour(date: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(date);
  let hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  if (hour === 24) hour = 0;
  return hour;
}

function formatHourAmPm(hour: number): string {
  const h = hour % 12 === 0 ? 12 : hour % 12;
  const ampm = hour < 12 ? "AM" : "PM";
  return `${h} ${ampm}`;
}

function formatZonedDateLabel(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

type PeriodRawEntry = {
  id: string;
  queueId: string;
  status: QueueEntryStatus;
  joinedAt: Date;
  calledAt: Date | null;
  servingAt: Date | null;
  completedAt: Date | null;
  cancelledAt: Date | null;
  updatedAt: Date;
};

function filterRelevantEntries(entries: PeriodRawEntry[], start: Date, end: Date) {
  return entries.filter((entry) => {
    if (entry.status === "WAITING" || entry.status === "CALLED" || entry.status === "SERVING") {
      return inRange(entry.joinedAt, start, end);
    }
    return (
      inRange(entry.joinedAt, start, end) ||
      inRange(entry.calledAt, start, end) ||
      inRange(entry.servingAt, start, end) ||
      inRange(entry.completedAt, start, end) ||
      inRange(entry.cancelledAt, start, end) ||
      ((entry.status === "SKIPPED" || entry.status === "NO_SHOW") &&
        inRange(entry.updatedAt, start, end))
    );
  });
}

function calculateMetrics(relevant: PeriodRawEntry[]) {
  const counts: Record<QueueEntryStatus, number> = {
    WAITING: 0,
    CALLED: 0,
    SERVING: 0,
    COMPLETED: 0,
    SKIPPED: 0,
    CANCELLED: 0,
    NO_SHOW: 0,
  };

  let waitTotal = 0;
  let waitCount = 0;
  let serviceTotal = 0;
  let serviceCount = 0;

  for (const entry of relevant) {
    counts[entry.status] = (counts[entry.status] || 0) + 1;

    // Customer waiting duration: from joinedAt until service begins (servingAt) or ticket is called (calledAt)
    const serviceBegun = entry.servingAt ?? entry.calledAt;
    if (serviceBegun && entry.joinedAt && serviceBegun >= entry.joinedAt) {
      waitTotal += serviceBegun.getTime() - entry.joinedAt.getTime();
      waitCount += 1;
    }

    // Service duration: from servingAt to completedAt for COMPLETED tickets
    if (
      entry.status === "COMPLETED" &&
      entry.completedAt &&
      entry.servingAt &&
      entry.completedAt >= entry.servingAt
    ) {
      serviceTotal += entry.completedAt.getTime() - entry.servingAt.getTime();
      serviceCount += 1;
    }
  }

  const totalCustomers = relevant.length;
  const terminalCount =
    counts.COMPLETED + counts.SKIPPED + counts.CANCELLED + counts.NO_SHOW;

  const completionRate =
    terminalCount > 0 ? Math.round((counts.COMPLETED / terminalCount) * 100) : null;

  return {
    totalCustomers,
    counts,
    terminalCount,
    completionRate,
    avgWaitMs: waitCount > 0 ? Math.round(waitTotal / waitCount) : null,
    avgServiceMs: serviceCount > 0 ? Math.round(serviceTotal / serviceCount) : null,
    customersServed: counts.COMPLETED,
    skippedCount: counts.SKIPPED,
    noShowCount: counts.NO_SHOW,
    cancelledCount: counts.CANCELLED,
    skippedOrNoShowCount: counts.SKIPPED + counts.NO_SHOW,
  };
}

function buildVolumeChartAndPeak(
  entries: PeriodRawEntry[],
  range: AnalyticsPeriodResult,
  timeZone: string
): { chartBuckets: VolumeChartBucket[]; peakHours: PeakHoursInfo; chartType: "hourly" | "daily" } {
  if (range.period === "today" || range.period === "yesterday") {
    // 24 Hourly buckets
    const hourlyCounts: { served: number; total: number }[] = Array.from({ length: 24 }, () => ({
      served: 0,
      total: 0,
    }));

    for (const entry of entries) {
      if (entry.joinedAt && inRange(entry.joinedAt, range.start, range.end)) {
        const hour = getZonedHour(entry.joinedAt, timeZone);
        hourlyCounts[hour].total += 1;
      }
      if (
        entry.status === "COMPLETED" &&
        entry.completedAt &&
        inRange(entry.completedAt, range.start, range.end)
      ) {
        const hour = getZonedHour(entry.completedAt, timeZone);
        hourlyCounts[hour].served += 1;
      }
    }

    // Find max volume to highlight peak
    let maxTotal = 0;
    for (const h of hourlyCounts) {
      if (h.total > maxTotal) maxTotal = h.total;
    }

    const chartBuckets: VolumeChartBucket[] = hourlyCounts.map((h, hour) => ({
      key: `hour-${hour}`,
      label: formatHourAmPm(hour),
      subLabel: `${hour.toString().padStart(2, "0")}:00`,
      servedCount: h.served,
      totalEntries: h.total,
      isPeak: maxTotal > 0 && h.total === maxTotal,
    }));

    // Find best 2-hour rolling window for Peak Hours display
    let bestWindowStart = -1;
    let bestServedInWindow = 0;
    let bestTotalInWindow = 0;

    for (let startHour = 0; startHour < 23; startHour++) {
      const servedIn2h = hourlyCounts[startHour].served + hourlyCounts[startHour + 1].served;
      const totalIn2h = hourlyCounts[startHour].total + hourlyCounts[startHour + 1].total;
      if (totalIn2h > bestTotalInWindow || (totalIn2h === bestTotalInWindow && servedIn2h > bestServedInWindow)) {
        bestTotalInWindow = totalIn2h;
        bestServedInWindow = servedIn2h;
        bestWindowStart = startHour;
      }
    }

    let peakHours: PeakHoursInfo = null;
    if (bestTotalInWindow > 0 && bestWindowStart >= 0) {
      const startStr = formatHourAmPm(bestWindowStart);
      const endStr = formatHourAmPm((bestWindowStart + 2) % 24);
      peakHours = {
        timeWindow: `${startStr} – ${endStr}`,
        customersServed: bestServedInWindow,
        totalEntries: bestTotalInWindow,
      };
    }

    return { chartBuckets, peakHours, chartType: "hourly" };
  }

  // Multi-day chart (last7days / last30days)
  const numDays = range.period === "last7days" ? 7 : 30;
  const dayBucketsMap = new Map<string, { label: string; served: number; total: number; date: Date }>();

  for (let i = 0; i < numDays; i++) {
    const d = new Date(range.start.getTime() + i * 24 * 60 * 60 * 1000);
    const key = new Intl.DateTimeFormat("en-US", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(d);
    const label = formatZonedDateLabel(d, timeZone);
    dayBucketsMap.set(key, { label, served: 0, total: 0, date: d });
  }

  for (const entry of entries) {
    if (entry.joinedAt && inRange(entry.joinedAt, range.start, range.end)) {
      const key = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(entry.joinedAt);
      const b = dayBucketsMap.get(key);
      if (b) b.total += 1;
    }
    if (
      entry.status === "COMPLETED" &&
      entry.completedAt &&
      inRange(entry.completedAt, range.start, range.end)
    ) {
      const key = new Intl.DateTimeFormat("en-US", {
        timeZone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(entry.completedAt);
      const b = dayBucketsMap.get(key);
      if (b) b.served += 1;
    }
  }

  let maxDayTotal = 0;
  for (const b of dayBucketsMap.values()) {
    if (b.total > maxDayTotal) maxDayTotal = b.total;
  }

  const chartBuckets: VolumeChartBucket[] = Array.from(dayBucketsMap.entries()).map(([key, b]) => ({
    key,
    label: b.label,
    servedCount: b.served,
    totalEntries: b.total,
    isPeak: maxDayTotal > 0 && b.total === maxDayTotal,
  }));

  // Peak for multi-day: the single busiest day
  let peakHours: PeakHoursInfo = null;
  const peakDay = chartBuckets.find((b) => b.isPeak);
  if (peakDay && peakDay.totalEntries > 0) {
    peakHours = {
      timeWindow: peakDay.label,
      customersServed: peakDay.servedCount,
      totalEntries: peakDay.totalEntries,
    };
  }

  return { chartBuckets, peakHours, chartType: "daily" };
}

function generateDeterministicInsights(params: {
  periodLabel: string;
  comparisonLabel: string;
  totalCustomers: number;
  customersServed: number;
  completionRate: number | null;
  avgWaitMs: number | null;
  avgServiceMs: number | null;
  liveWaiting: number;
  activeQueuesCount: number;
  skippedCount: number;
  noShowCount: number;
  peakHours: PeakHoursInfo;
  isWaitTimeHigh: boolean;
  waitTrend: MetricTrend;
  servedTrend: MetricTrend;
}): BusinessInsightItem[] {
  const insights: BusinessInsightItem[] = [];

  if (params.totalCustomers === 0) {
    insights.push({
      id: "no-data",
      type: "info",
      title: "No queue traffic recorded",
      description: `There were no customer queue entries during ${params.periodLabel.toLowerCase()}. Insights will update automatically as customers join.`,
    });
    return insights;
  }

  // 1. Peak period insight
  if (params.peakHours) {
    insights.push({
      id: "peak-hours",
      type: "info",
      title: `Busiest period: ${params.peakHours.timeWindow}`,
      description: `${params.peakHours.totalEntries} customer entries recorded with ${params.peakHours.customersServed} completed during this window.`,
    });
  }

  // 2. Wait time insight
  if (params.avgWaitMs != null) {
    const mins = Math.round(params.avgWaitMs / 60000);
    const durationStr = mins < 1 ? "<1 min" : `${mins} min`;
    const trendDetail =
      params.waitTrend.diffPercent != null
        ? ` (${params.waitTrend.text})`
        : "";

    if (params.isWaitTimeHigh) {
      insights.push({
        id: "wait-warning",
        type: "warning",
        title: "Wait times elevated",
        description: `Average customer wait is ${durationStr}${trendDetail}, which is above normal target thresholds.`,
      });
    } else {
      insights.push({
        id: "wait-healthy",
        type: "positive",
        title: `Average wait time is ${durationStr}`,
        description: `Customers are being called and served efficiently${trendDetail}.`,
      });
    }
  }

  // 3. Realtime queue status
  if (params.liveWaiting > 0) {
    insights.push({
      id: "live-waiting",
      type: params.liveWaiting > 10 ? "warning" : "neutral",
      title: `${params.liveWaiting} customer${params.liveWaiting === 1 ? "" : "s"} currently in line`,
      description: `Active queue pressure across ${params.activeQueuesCount} running queue${params.activeQueuesCount === 1 ? "" : "s"}.`,
    });
  } else {
    insights.push({
      id: "live-clear",
      type: "positive",
      title: "Queue is currently clear",
      description: "No customers are currently waiting in line.",
    });
  }

  // 4. Completion rate & outcomes
  if (params.completionRate != null) {
    const drops = params.skippedCount + params.noShowCount;
    if (params.completionRate >= 85) {
      insights.push({
        id: "completion-high",
        type: "positive",
        title: `Strong ${params.completionRate}% completion rate`,
        description: `${params.customersServed} tickets served with only ${drops} customer drop-off${drops === 1 ? "" : "s"}.`,
      });
    } else {
      insights.push({
        id: "completion-drops",
        type: "warning",
        title: `Completion rate is ${params.completionRate}%`,
        description: `${drops} customer${drops === 1 ? "" : "s"} did not complete service (${params.skippedCount} skipped, ${params.noShowCount} no-shows).`,
      });
    }
  }

  // 5. Volume comparison trend
  if (params.servedTrend.diffPercent != null && params.servedTrend.diffPercent > 0) {
    insights.push({
      id: "served-growth",
      type: "info",
      title: `Service volume ${params.servedTrend.direction === "up" ? "increased" : "decreased"}`,
      description: `Total customers served changed by ${params.servedTrend.text}.`,
    });
  }

  return insights;
}

export async function getBusinessInsights(
  businessId: string,
  options?: {
    queueId?: string;
    period?: AnalyticsPeriod;
  }
): Promise<{ snapshot?: BusinessInsightsSnapshot; error?: string }> {
  try {
    const user = await getCurrentUser();
    const { business, workspace } = await getAuthorizedBusinessForUser(user, businessId);
    const period = options?.period ?? "today";

    const range = getAnalyticsPeriodRange(business.timezone, period);

    // Fetch all queues for this business
    const allQueues = await prisma.queue.findMany({
      where: { businessId: business.id, workspaceId: workspace.id },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        name: true,
        status: true,
        averageServiceTime: true,
      },
    });

    const selectedQueueId =
      options?.queueId && allQueues.some((q) => q.id === options.queueId)
        ? options.queueId
        : null;

    const targetQueueIds = selectedQueueId
      ? [selectedQueueId]
      : allQueues.map((q) => q.id);

    if (targetQueueIds.length === 0) {
      // Empty business without any queues
      return {
        snapshot: {
          businessId: business.id,
          businessName: business.name,
          businessTimezone: business.timezone,
          selectedQueueId: null,
          period,
          periodLabel: range.label,
          comparisonLabel: range.comparisonLabel,
          queues: [],
          liveWaiting: 0,
          liveServing: 0,
          liveCalled: 0,
          activeQueuesCount: 0,
          customersServed: 0,
          servedTrend: { direction: "flat", diffPercent: null, text: "No baseline comparison" },
          totalCustomers: 0,
          totalCustomersTrend: { direction: "flat", diffPercent: null, text: "No baseline comparison" },
          avgWaitMs: null,
          waitTrend: { direction: "flat", diffPercent: null, text: "No baseline comparison" },
          avgServiceMs: null,
          serviceTrend: { direction: "flat", diffPercent: null, text: "No baseline comparison" },
          completionRate: null,
          completionRateTrend: { direction: "flat", diffPercent: null, text: "No baseline comparison" },
          skippedCount: 0,
          noShowCount: 0,
          cancelledCount: 0,
          skippedOrNoShowCount: 0,
          outcomes: [],
          chartType: "hourly",
          chartBuckets: [],
          peakHours: null,
          isWaitTimeHigh: false,
          waitTimeWarningText: null,
          insights: [
            {
              id: "no-queues",
              type: "info",
              title: "No queues set up yet",
              description: "Create your first queue to start managing customers and collecting insights.",
            },
          ],
        },
      };
    }

    // Live counts (WAITING, CALLED, SERVING)
    const liveCounts = await prisma.queueEntry.groupBy({
      by: ["status"],
      where: {
        queueId: { in: targetQueueIds },
        status: { in: ["WAITING", "CALLED", "SERVING"] },
      },
      _count: { _all: true },
    });

    let liveWaiting = 0;
    let liveServing = 0;
    let liveCalled = 0;
    for (const row of liveCounts) {
      if (row.status === "WAITING") liveWaiting = row._count._all;
      if (row.status === "SERVING") liveServing = row._count._all;
      if (row.status === "CALLED") liveCalled = row._count._all;
    }

    // Current period entries (privacy-safe: strictly IDs and timestamps, no PII)
    const currentRawEntries = await prisma.queueEntry.findMany({
      where: {
        queueId: { in: targetQueueIds },
        OR: [
          { joinedAt: { gte: range.start, lt: range.end } },
          { calledAt: { gte: range.start, lt: range.end } },
          { servingAt: { gte: range.start, lt: range.end } },
          { completedAt: { gte: range.start, lt: range.end } },
          { cancelledAt: { gte: range.start, lt: range.end } },
          {
            AND: [
              { status: { in: ["SKIPPED", "NO_SHOW"] } },
              { updatedAt: { gte: range.start, lt: range.end } },
            ],
          },
        ],
      },
      select: {
        id: true,
        queueId: true,
        status: true,
        joinedAt: true,
        calledAt: true,
        servingAt: true,
        completedAt: true,
        cancelledAt: true,
        updatedAt: true,
      },
    });

    // Previous period entries (for baseline comparison)
    const prevRawEntries = await prisma.queueEntry.findMany({
      where: {
        queueId: { in: targetQueueIds },
        OR: [
          { joinedAt: { gte: range.prevStart, lt: range.prevEnd } },
          { calledAt: { gte: range.prevStart, lt: range.prevEnd } },
          { servingAt: { gte: range.prevStart, lt: range.prevEnd } },
          { completedAt: { gte: range.prevStart, lt: range.prevEnd } },
          { cancelledAt: { gte: range.prevStart, lt: range.prevEnd } },
          {
            AND: [
              { status: { in: ["SKIPPED", "NO_SHOW"] } },
              { updatedAt: { gte: range.prevStart, lt: range.prevEnd } },
            ],
          },
        ],
      },
      select: {
        id: true,
        queueId: true,
        status: true,
        joinedAt: true,
        calledAt: true,
        servingAt: true,
        completedAt: true,
        cancelledAt: true,
        updatedAt: true,
      },
    });

    const relevantCurrent = filterRelevantEntries(currentRawEntries, range.start, range.end);
    const relevantPrev = filterRelevantEntries(prevRawEntries, range.prevStart, range.prevEnd);

    const currentMetrics = calculateMetrics(relevantCurrent);
    const prevMetrics = calculateMetrics(relevantPrev);

    // Comparisons
    const servedTrend = computeTrend(
      currentMetrics.customersServed,
      prevMetrics.customersServed,
      range.comparisonLabel
    );

    const totalCustomersTrend = computeTrend(
      currentMetrics.totalCustomers,
      prevMetrics.totalCustomers,
      range.comparisonLabel
    );

    const waitTrend = computeTrend(
      currentMetrics.avgWaitMs,
      prevMetrics.avgWaitMs,
      range.comparisonLabel,
      true // lower is better
    );

    const serviceTrend = computeTrend(
      currentMetrics.avgServiceMs,
      prevMetrics.avgServiceMs,
      range.comparisonLabel
    );

    const completionRateTrend = computeTrend(
      currentMetrics.completionRate,
      prevMetrics.completionRate,
      range.comparisonLabel
    );

    // Queue outcomes breakdown
    const outcomes: QueueOutcomeItem[] = [
      {
        status: "COMPLETED",
        label: "Completed",
        count: currentMetrics.counts.COMPLETED,
        percentage:
          currentMetrics.terminalCount > 0
            ? Math.round((currentMetrics.counts.COMPLETED / currentMetrics.terminalCount) * 100)
            : 0,
      },
      {
        status: "SKIPPED",
        label: "Skipped",
        count: currentMetrics.counts.SKIPPED,
        percentage:
          currentMetrics.terminalCount > 0
            ? Math.round((currentMetrics.counts.SKIPPED / currentMetrics.terminalCount) * 100)
            : 0,
      },
      {
        status: "CANCELLED",
        label: "Cancelled",
        count: currentMetrics.counts.CANCELLED,
        percentage:
          currentMetrics.terminalCount > 0
            ? Math.round((currentMetrics.counts.CANCELLED / currentMetrics.terminalCount) * 100)
            : 0,
      },
      {
        status: "NO_SHOW",
        label: "No-show",
        count: currentMetrics.counts.NO_SHOW,
        percentage:
          currentMetrics.terminalCount > 0
            ? Math.round((currentMetrics.counts.NO_SHOW / currentMetrics.terminalCount) * 100)
            : 0,
      },
    ];

    // Volume Chart & Peak Hours
    const { chartBuckets, peakHours, chartType } = buildVolumeChartAndPeak(
      relevantCurrent,
      range,
      business.timezone
    );

    // Wait time warning
    // Trigger condition: wait time >= 30 minutes OR surge > 35% over baseline with wait >= 15 minutes
    const waitMins = currentMetrics.avgWaitMs ? currentMetrics.avgWaitMs / 60000 : 0;
    const isWaitTimeHigh =
      waitMins >= WAIT_TIME_WARNING_THRESHOLD_MINUTES ||
      (waitMins >= 15 &&
        prevMetrics.avgWaitMs != null &&
        currentMetrics.avgWaitMs != null &&
        currentMetrics.avgWaitMs > prevMetrics.avgWaitMs * 1.35);

    const waitTimeWarningText = isWaitTimeHigh
      ? `Wait times are elevated (${Math.round(waitMins)} min average). Consider adding staff capacity or notifying waiting customers.`
      : null;

    // Rule-based insights
    const activeQueuesCount = allQueues.filter((q) => q.status === "ACTIVE" || q.status === "OPEN").length;
    const insights = generateDeterministicInsights({
      periodLabel: range.label,
      comparisonLabel: range.comparisonLabel,
      totalCustomers: currentMetrics.totalCustomers,
      customersServed: currentMetrics.customersServed,
      completionRate: currentMetrics.completionRate,
      avgWaitMs: currentMetrics.avgWaitMs,
      avgServiceMs: currentMetrics.avgServiceMs,
      liveWaiting,
      activeQueuesCount,
      skippedCount: currentMetrics.skippedCount,
      noShowCount: currentMetrics.noShowCount,
      peakHours,
      isWaitTimeHigh,
      waitTrend,
      servedTrend,
    });

    return {
      snapshot: {
        businessId: business.id,
        businessName: business.name,
        businessTimezone: business.timezone,
        selectedQueueId,
        period,
        periodLabel: range.label,
        comparisonLabel: range.comparisonLabel,
        queues: allQueues,
        liveWaiting,
        liveServing,
        liveCalled,
        activeQueuesCount,
        customersServed: currentMetrics.customersServed,
        servedTrend,
        totalCustomers: currentMetrics.totalCustomers,
        totalCustomersTrend,
        avgWaitMs: currentMetrics.avgWaitMs,
        waitTrend,
        avgServiceMs: currentMetrics.avgServiceMs,
        serviceTrend,
        completionRate: currentMetrics.completionRate,
        completionRateTrend,
        skippedCount: currentMetrics.skippedCount,
        noShowCount: currentMetrics.noShowCount,
        cancelledCount: currentMetrics.cancelledCount,
        skippedOrNoShowCount: currentMetrics.skippedOrNoShowCount,
        outcomes,
        chartType,
        chartBuckets,
        peakHours,
        isWaitTimeHigh,
        waitTimeWarningText,
        insights,
      },
    };
  } catch (err) {
    console.error("getBusinessInsights error:", err);
    return { error: "Business insights could not be loaded. Please try again." };
  }
}
