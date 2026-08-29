import type { QueueStatus, QueueEntryStatus } from "@/generated/prisma";

const QUEUE_TRANSITIONS: Record<QueueStatus, QueueStatus[]> = {
  DRAFT: ["OPEN", "ACTIVE", "INACTIVE", "ARCHIVED"],
  OPEN: ["ACTIVE", "INACTIVE", "PAUSED", "CLOSED"],
  ACTIVE: ["INACTIVE", "PAUSED", "CLOSED"],
  INACTIVE: ["ACTIVE", "ARCHIVED"],
  PAUSED: ["ACTIVE", "INACTIVE", "CLOSED"],
  CLOSED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransitionQueue(from: QueueStatus, to: QueueStatus): boolean {
  return QUEUE_TRANSITIONS[from]?.includes(to) ?? false;
}

// A queue accepts new customers in OPEN or ACTIVE.
export function queueAcceptsJoins(status: QueueStatus): boolean {
  return status === "OPEN" || status === "ACTIVE";
}

const ENTRY_TRANSITIONS: Record<QueueEntryStatus, QueueEntryStatus[]> = {
  WAITING: ["CALLED", "SKIPPED", "CANCELLED"],
  CALLED: ["SERVING", "NO_SHOW", "WAITING", "CANCELLED"],
  SERVING: ["COMPLETED", "CANCELLED"],
  COMPLETED: [],
  SKIPPED: ["WAITING"], // requeue a skipped customer
  CANCELLED: [],
  NO_SHOW: ["WAITING"], // requeue a no-show
};

export function canTransitionEntry(
  from: QueueEntryStatus,
  to: QueueEntryStatus
): boolean {
  return ENTRY_TRANSITIONS[from]?.includes(to) ?? false;
}
