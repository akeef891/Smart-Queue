"use server";

import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedQueueForUser } from "@/lib/tenant";
import { getAnalyticsPeriodRange, type AnalyticsPeriod } from "@/lib/analytics-range";
import type { QueueEntryStatus } from "@/generated/prisma";

export type QueueAnalyticsSnapshot = {
  queueName: string;
  rangeLabel: string;
  totalCustomers: number;
  completed: number;
  cancelled: number;
  waiting: number;
  called: number;
  serving: number;
  skipped: number;
  noShow: number;
  avgWaitMs: number | null;
  avgServiceMs: number | null;
  completionRate: number | null;
};

function inRange(value: Date | null, start: Date, end: Date) {
  return Boolean(value && value >= start && value < end);
}

export async function getQueueAnalytics(
  businessId: string,
  queueId: string,
  period: AnalyticsPeriod = "today"
) {
  try {
    const user = await getCurrentUser();
    const { queue, business, role } = await getAuthorizedQueueForUser(user, queueId, businessId);
    if (role === "STAFF") {
      return { error: "Staff members do not have permission to view queue analytics." };
    }
    const { start, end, label } = getAnalyticsPeriodRange(business.timezone, period);

    const entries = await prisma.queueEntry.findMany({
      where: {
        queueId: queue.id,
        OR: [
          { joinedAt: { gte: start, lt: end } },
          { calledAt: { gte: start, lt: end } },
          { servingAt: { gte: start, lt: end } },
          { completedAt: { gte: start, lt: end } },
          { cancelledAt: { gte: start, lt: end } },
          { status: { in: ["WAITING", "CALLED", "SERVING"] } },
          {
            AND: [
              { status: { in: ["SKIPPED", "NO_SHOW"] } },
              { updatedAt: { gte: start, lt: end } },
            ],
          },
        ],
      },
      select: {
        status: true,
        joinedAt: true,
        servingAt: true,
        completedAt: true,
        calledAt: true,
        cancelledAt: true,
        updatedAt: true,
      },
    });

    const relevant = entries.filter((entry) => {
      if (entry.status === "WAITING" || entry.status === "CALLED" || entry.status === "SERVING") {
        return true;
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
      counts[entry.status] += 1;

      if (entry.servingAt && entry.joinedAt && entry.servingAt >= entry.joinedAt) {
        waitTotal += entry.servingAt.getTime() - entry.joinedAt.getTime();
        waitCount += 1;
      }

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

    return {
      snapshot: {
        queueName: queue.name,
        rangeLabel: label,
        totalCustomers,
        completed: counts.COMPLETED,
        cancelled: counts.CANCELLED,
        waiting: counts.WAITING,
        called: counts.CALLED,
        serving: counts.SERVING,
        skipped: counts.SKIPPED,
        noShow: counts.NO_SHOW,
        avgWaitMs: waitCount > 0 ? waitTotal / waitCount : null,
        avgServiceMs: serviceCount > 0 ? serviceTotal / serviceCount : null,
        completionRate:
          totalCustomers > 0 ? Math.round((counts.COMPLETED / totalCustomers) * 100) : null,
      } satisfies QueueAnalyticsSnapshot,
    };
  } catch {
    return { error: "Analytics could not be loaded. Please try again." };
  }
}
