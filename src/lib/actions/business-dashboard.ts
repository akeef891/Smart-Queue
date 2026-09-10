"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedBusinessForUser } from "@/lib/tenant";
import { getAnalyticsPeriodRange } from "@/lib/analytics-range";
import { queueAcceptsJoins } from "@/lib/queue-state";
import type { QueueStatus } from "@/generated/prisma";

export type BusinessQueueSummary = {
  id: string;
  name: string;
  status: QueueStatus;
  waiting: number;
  called: number;
  serving: number;
  servedToday: number;
  cancelledToday: number;
  maxCapacity: number | null;
  averageServiceTime: number;
};

export type BusinessDashboardSnapshot = {
  businessName: string;
  businessStatus: string;
  greeting: string;
  activeQueues: number;
  waiting: number;
  serving: number;
  called: number;
  servedToday: number;
  cancelledToday: number;
  queues: BusinessQueueSummary[];
};

function hourInTimeZone(now: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "numeric",
    hourCycle: "h23",
  }).formatToParts(now);
  let hour = Number(parts.find((part) => part.type === "hour")?.value ?? "0");
  if (hour === 24) hour = 0;
  return hour;
}

function greetingForHour(hour: number) {
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

function countMap(rows: { queueId: string; _count: { _all: number } }[]) {
  const map = new Map<string, number>();
  for (const row of rows) {
    map.set(row.queueId, row._count._all);
  }
  return map;
}

export async function getBusinessDashboard(businessId: string) {
  try {
    const user = await getCurrentUser();
    const { business, workspace } = await getAuthorizedBusinessForUser(user, businessId);
    const { start, end } = getAnalyticsPeriodRange(business.timezone);

    const queues = await prisma.queue.findMany({
      where: { businessId: business.id, workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        status: true,
        maxCapacity: true,
        averageServiceTime: true,
      },
    });

    const queueIds = queues.map((queue) => queue.id);

    const [liveCounts, servedTodayCounts, cancelledTodayCounts] =
      queueIds.length === 0
        ? [[], [], []]
        : await Promise.all([
            prisma.queueEntry.groupBy({
              by: ["queueId", "status"],
              where: {
                queueId: { in: queueIds },
                status: { in: ["WAITING", "CALLED", "SERVING"] },
              },
              _count: { _all: true },
            }),
            prisma.queueEntry.groupBy({
              by: ["queueId"],
              where: {
                queueId: { in: queueIds },
                status: "COMPLETED",
                completedAt: { gte: start, lt: end },
              },
              _count: { _all: true },
            }),
            prisma.queueEntry.groupBy({
              by: ["queueId"],
              where: {
                queueId: { in: queueIds },
                status: "CANCELLED",
                cancelledAt: { gte: start, lt: end },
              },
              _count: { _all: true },
            }),
          ]);

    const waitingByQueue = new Map<string, number>();
    const calledByQueue = new Map<string, number>();
    const servingByQueue = new Map<string, number>();
    for (const row of liveCounts) {
      const count = row._count._all;
      if (row.status === "WAITING") waitingByQueue.set(row.queueId, count);
      if (row.status === "CALLED") calledByQueue.set(row.queueId, count);
      if (row.status === "SERVING") servingByQueue.set(row.queueId, count);
    }

    const servedTodayByQueue = countMap(servedTodayCounts);
    const cancelledTodayByQueue = countMap(cancelledTodayCounts);

    const summaries: BusinessQueueSummary[] = queues.map((queue) => ({
      id: queue.id,
      name: queue.name,
      status: queue.status,
      waiting: waitingByQueue.get(queue.id) ?? 0,
      called: calledByQueue.get(queue.id) ?? 0,
      serving: servingByQueue.get(queue.id) ?? 0,
      servedToday: servedTodayByQueue.get(queue.id) ?? 0,
      cancelledToday: cancelledTodayByQueue.get(queue.id) ?? 0,
      maxCapacity: queue.maxCapacity,
      averageServiceTime: queue.averageServiceTime,
    }));

    const snapshot: BusinessDashboardSnapshot = {
      businessName: business.name,
      businessStatus: business.status,
      greeting: greetingForHour(hourInTimeZone(new Date(), business.timezone || "UTC")),
      activeQueues: summaries.filter((queue) => queueAcceptsJoins(queue.status)).length,
      waiting: summaries.reduce((sum, queue) => sum + queue.waiting, 0),
      serving: summaries.reduce((sum, queue) => sum + queue.serving, 0),
      called: summaries.reduce((sum, queue) => sum + queue.called, 0),
      servedToday: summaries.reduce((sum, queue) => sum + queue.servedToday, 0),
      cancelledToday: summaries.reduce((sum, queue) => sum + queue.cancelledToday, 0),
      queues: summaries,
    };

    return { snapshot };
  } catch {
    return { error: "This dashboard could not be loaded. Please try again." };
  }
}
