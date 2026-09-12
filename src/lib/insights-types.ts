import type { QueueEntryStatus } from "@/generated/prisma";
import type { AnalyticsPeriod } from "@/lib/analytics-range";

/**
 * Wait time warning threshold in minutes.
 * If average customer wait exceeds this duration or surges >35% over the previous period,
 * a proactive warning is highlighted on the dashboard.
 */
export const WAIT_TIME_WARNING_THRESHOLD_MINUTES = 30;

export type TrendDirection = "up" | "down" | "flat";

export type MetricTrend = {
  direction: TrendDirection;
  diffPercent: number | null;
  text: string;
};

export type QueueOutcomeItem = {
  status: QueueEntryStatus;
  label: string;
  count: number;
  percentage: number;
};

export type VolumeChartBucket = {
  key: string;
  label: string;
  subLabel?: string;
  servedCount: number;
  totalEntries: number;
  isPeak: boolean;
};

export type PeakHoursInfo = {
  timeWindow: string;
  customersServed: number;
  totalEntries: number;
} | null;

export type BusinessInsightItem = {
  id: string;
  type: "positive" | "warning" | "neutral" | "info";
  title: string;
  description: string;
};

export type BusinessInsightsSnapshot = {
  businessId: string;
  businessName: string;
  businessTimezone: string;
  selectedQueueId: string | null;
  period: AnalyticsPeriod;
  periodLabel: string;
  comparisonLabel: string;
  queues: {
    id: string;
    name: string;
    status: string;
    averageServiceTime: number;
  }[];

  // Live real-time stats
  liveWaiting: number;
  liveServing: number;
  liveCalled: number;
  activeQueuesCount: number;

  // Period KPIs
  customersServed: number;
  servedTrend: MetricTrend;

  totalCustomers: number;
  totalCustomersTrend: MetricTrend;

  avgWaitMs: number | null;
  waitTrend: MetricTrend;

  avgServiceMs: number | null;
  serviceTrend: MetricTrend;

  completionRate: number | null; // percentage: 0 - 100
  completionRateTrend: MetricTrend;

  skippedCount: number;
  noShowCount: number;
  cancelledCount: number;
  skippedOrNoShowCount: number;

  // Queue Outcomes
  outcomes: QueueOutcomeItem[];

  // Volume Chart
  chartType: "hourly" | "daily";
  chartBuckets: VolumeChartBucket[];

  // Peak Hours
  peakHours: PeakHoursInfo;

  // Rule-based Insights & Warnings
  isWaitTimeHigh: boolean;
  waitTimeWarningText: string | null;
  insights: BusinessInsightItem[];
};
