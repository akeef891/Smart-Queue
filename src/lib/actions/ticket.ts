"use server";

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { getAuthorizedQueueForUser } from "@/lib/tenant";
import { customerJoinSchema } from "@/lib/validations";
import { canTransitionEntry, queueAcceptsJoins } from "@/lib/queue-state";
import { formatTicketNumber } from "@/lib/ticket";
import { notifyQueueChanged } from "@/lib/realtime-notify";
import { revalidatePath } from "next/cache";
import type { QueueEntry, QueueEntryStatus } from "@/generated/prisma";

class JoinError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "JoinError";
  }
}

function mapError(err: unknown, action: string): { error: string } {
  if (err instanceof JoinError) {
    return { error: err.message };
  }
  if (err instanceof AuthError) {
    if (err.code === "UNAUTHENTICATED") {
      return { error: "Please sign in to continue." };
    }
    return { error: "You do not have permission to manage this queue." };
  }
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return { error: "That ticket number was already issued. Please try again." };
    }
    return { error: "We couldn't update the queue. Please try again." };
  }
  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError
  ) {
    return { error: "We're having trouble connecting to the database. Please try again in a moment." };
  }
  console.error(`${action} failed:`, err instanceof Error ? err.name : "unknown");
  return { error: "Something went wrong. Please try again." };
}

function revalidateTicketPaths(businessId: string, queueId: string, trackingToken?: string) {
  revalidatePath("/dashboard");
  revalidatePath(`/businesses/${businessId}`);
  revalidatePath(`/businesses/${businessId}/queues/${queueId}`);
  revalidatePath(`/businesses/${businessId}/queues/${queueId}/join`);
  if (trackingToken) {
    revalidatePath(`/businesses/${businessId}/queues/${queueId}/ticket/${trackingToken}`);
    revalidatePath(`/track/${trackingToken}`);
  }
}

async function lockQueue(tx: Prisma.TransactionClient, queueId: string) {
  await tx.$queryRaw`SELECT id FROM "queues" WHERE id = ${queueId} FOR UPDATE`;
}

export async function joinQueue(input: unknown) {
  try {
    const raw = input as { businessId?: unknown; queueId?: unknown };
    if (typeof raw?.queueId !== "string") {
      return { error: "This queue could not be found." };
    }

    const parsed = customerJoinSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Enter your name." };
    }

    const extra = input as { customerPhone?: unknown; customerEmail?: unknown };
    const customerPhone =
      typeof extra.customerPhone === "string" && extra.customerPhone.trim()
        ? extra.customerPhone.trim()
        : null;
    const customerEmail =
      typeof extra.customerEmail === "string" && extra.customerEmail.trim()
        ? extra.customerEmail.trim()
        : null;

    const entry = await prisma.$transaction(async (tx) => {
      await lockQueue(tx, raw.queueId as string);

      const queue = await tx.queue.findFirst({
        where: { id: raw.queueId as string },
        include: { business: { select: { id: true, name: true, status: true } } },
      });

      if (!queue || queue.business.status === "ARCHIVED") {
        throw new JoinError("This queue could not be found.");
      }
      if (typeof raw.businessId === "string" && queue.businessId !== raw.businessId) {
        throw new JoinError("This queue could not be found.");
      }
      if (!queueAcceptsJoins(queue.status)) {
        throw new JoinError("This queue is not accepting customers right now.");
      }

      const waitingCount = await tx.queueEntry.count({
        where: { queueId: queue.id, status: "WAITING" },
      });

      if (queue.maxCapacity && waitingCount >= queue.maxCapacity) {
        throw new JoinError("This queue is currently full.");
      }

      const updatedQueue = await tx.queue.update({
        where: { id: queue.id },
        data: { lastIssuedToken: { increment: 1 } },
      });

      const tokenNumber = updatedQueue.lastIssuedToken;
      const position = waitingCount + 1;

      return tx.queueEntry.create({
        data: {
          workspaceId: queue.workspaceId,
          queueId: queue.id,
          customerName: parsed.data.customerName,
          customerPhone,
          customerEmail,
          tokenNumber,
          position,
          estimatedWaitTime: position * updatedQueue.averageServiceTime,
          status: "WAITING",
        },
      });
    });

    const queue = await prisma.queue.findFirstOrThrow({
      where: { id: entry.queueId },
      select: { slug: true, businessId: true, name: true },
    });

    revalidateTicketPaths(queue.businessId, entry.queueId, entry.trackingToken);
    notifyQueueChanged(entry.queueId);

    return {
      ticket: {
        id: entry.id,
        trackingToken: entry.trackingToken,
        tokenNumber: entry.tokenNumber,
        label: formatTicketNumber(queue.slug, entry.tokenNumber),
        status: entry.status,
        ticketUrl: `/businesses/${queue.businessId}/queues/${entry.queueId}/ticket/${entry.trackingToken}`,
      },
    };
  } catch (err) {
    return mapError(err, "joinQueue");
  }
}

export async function callNextTicket(input: unknown) {
  try {
    const user = await getCurrentUser();
    const raw = input as { businessId?: unknown; queueId?: unknown };
    if (typeof raw?.businessId !== "string" || typeof raw?.queueId !== "string") {
      return { error: "Queue could not be updated." };
    }

    const { queue, business } = await getAuthorizedQueueForUser(user, raw.queueId, raw.businessId);

    const result = await prisma.$transaction(async (tx) => {
      await lockQueue(tx, queue.id);

      const inProgress = await tx.queueEntry.findFirst({
        where: { queueId: queue.id, status: { in: ["CALLED", "SERVING"] } },
        orderBy: { tokenNumber: "asc" },
      });

      if (inProgress) {
        throw new JoinError(
          `Finish ${formatTicketNumber(queue.slug, inProgress.tokenNumber)} before calling the next customer.`
        );
      }

      const next = await tx.queueEntry.findFirst({
        where: { queueId: queue.id, status: "WAITING" },
        orderBy: { tokenNumber: "asc" },
      });

      if (!next) {
        throw new JoinError("No customers are waiting.");
      }

      const updated = await tx.queueEntry.updateMany({
        where: { id: next.id, status: "WAITING" },
        data: { status: "CALLED", calledAt: new Date() },
      });

      if (updated.count !== 1) {
        throw new JoinError("That customer was already called. Refresh and try again.");
      }

      return next;
    });

    revalidateTicketPaths(business.id, queue.id, result.trackingToken);
    notifyQueueChanged(queue.id);
    return { ticketId: result.id };
  } catch (err) {
    return mapError(err, "callNextTicket");
  }
}

async function transitionTicket(opts: {
  businessId: string;
  queueId: string;
  ticketId: string;
  from: QueueEntryStatus[];
  to: QueueEntryStatus;
  extra: Record<string, Date>;
  bumpServed?: boolean;
}) {
  const user = await getCurrentUser();
  const { queue, business } = await getAuthorizedQueueForUser(
    user,
    opts.queueId,
    opts.businessId
  );

  const result = await prisma.$transaction(async (tx) => {
    await lockQueue(tx, queue.id);

    const entry = await tx.queueEntry.findFirst({
      where: { id: opts.ticketId, queueId: queue.id },
    });

    if (!entry) {
      throw new JoinError("That ticket was not found in this queue.");
    }
    if (!opts.from.includes(entry.status) || !canTransitionEntry(entry.status, opts.to)) {
      throw new JoinError("This ticket cannot be updated from its current status.");
    }

    const updated = await tx.queueEntry.updateMany({
      where: { id: entry.id, status: entry.status },
      data: { status: opts.to, ...opts.extra },
    });

    if (updated.count !== 1) {
      throw new JoinError("This ticket was already updated. Refresh and try again.");
    }

    if (opts.bumpServed) {
      await tx.queue.update({
        where: { id: queue.id },
        data: { totalServed: { increment: 1 } },
      });
    }

    return entry;
  });

  revalidateTicketPaths(business.id, queue.id, result.trackingToken);
  notifyQueueChanged(queue.id);
  return { ok: true as const };
}

export async function startServingTicket(input: unknown) {
  try {
    const raw = input as { businessId?: unknown; queueId?: unknown; ticketId?: unknown };
    if (
      typeof raw?.businessId !== "string" ||
      typeof raw?.queueId !== "string" ||
      typeof raw?.ticketId !== "string"
    ) {
      return { error: "Ticket could not be updated." };
    }

    return await transitionTicket({
      businessId: raw.businessId,
      queueId: raw.queueId,
      ticketId: raw.ticketId,
      from: ["CALLED"],
      to: "SERVING",
      extra: { servingAt: new Date() },
    });
  } catch (err) {
    return mapError(err, "startServingTicket");
  }
}

export async function completeTicket(input: unknown) {
  try {
    const raw = input as { businessId?: unknown; queueId?: unknown; ticketId?: unknown };
    if (
      typeof raw?.businessId !== "string" ||
      typeof raw?.queueId !== "string" ||
      typeof raw?.ticketId !== "string"
    ) {
      return { error: "Ticket could not be completed." };
    }

    return await transitionTicket({
      businessId: raw.businessId,
      queueId: raw.queueId,
      ticketId: raw.ticketId,
      from: ["SERVING"],
      to: "COMPLETED",
      extra: { completedAt: new Date() },
      bumpServed: true,
    });
  } catch (err) {
    return mapError(err, "completeTicket");
  }
}

export async function cancelTicket(input: unknown) {
  try {
    const raw = input as { businessId?: unknown; queueId?: unknown; ticketId?: unknown };
    if (
      typeof raw?.businessId !== "string" ||
      typeof raw?.queueId !== "string" ||
      typeof raw?.ticketId !== "string"
    ) {
      return { error: "Ticket could not be cancelled." };
    }

    return await transitionTicket({
      businessId: raw.businessId,
      queueId: raw.queueId,
      ticketId: raw.ticketId,
      from: ["WAITING", "CALLED", "SERVING"],
      to: "CANCELLED",
      extra: { cancelledAt: new Date() },
    });
  } catch (err) {
    return mapError(err, "cancelTicket");
  }
}

const CUSTOMER_LEAVE_FROM: QueueEntryStatus[] = ["WAITING", "CALLED"];

/** Public: customer leaves using the unguessable trackingToken. Not a staff action. */
export async function leaveQueue(input: unknown) {
  try {
    const raw = input as {
      businessId?: unknown;
      queueId?: unknown;
      trackingToken?: unknown;
    };
    if (
      typeof raw?.businessId !== "string" ||
      typeof raw?.queueId !== "string" ||
      typeof raw?.trackingToken !== "string"
    ) {
      return { error: "This ticket could not be cancelled." };
    }

    const result = await prisma.$transaction(async (tx) => {
      await lockQueue(tx, raw.queueId as string);

      const entry = await tx.queueEntry.findFirst({
        where: {
          trackingToken: raw.trackingToken as string,
          queueId: raw.queueId as string,
          queue: { businessId: raw.businessId as string },
        },
      });

      if (!entry) {
        throw new JoinError("This ticket could not be found.");
      }
      if (
        !CUSTOMER_LEAVE_FROM.includes(entry.status) ||
        !canTransitionEntry(entry.status, "CANCELLED")
      ) {
        throw new JoinError("You can no longer leave this queue.");
      }

      const updated = await tx.queueEntry.updateMany({
        where: { id: entry.id, status: entry.status },
        data: { status: "CANCELLED", cancelledAt: new Date() },
      });

      if (updated.count !== 1) {
        throw new JoinError("This ticket was already updated. Refresh and try again.");
      }

      return entry;
    });

    revalidateTicketPaths(raw.businessId as string, result.queueId, result.trackingToken);
    notifyQueueChanged(result.queueId);
    return { ok: true as const };
  } catch (err) {
    return mapError(err, "leaveQueue");
  }
}

export async function getTicketPosition(entry: Pick<QueueEntry, "queueId" | "tokenNumber" | "status">) {
  if (entry.status !== "WAITING") {
    return { peopleAhead: 0, position: 0 };
  }

  const peopleAhead = await prisma.queueEntry.count({
    where: {
      queueId: entry.queueId,
      status: "WAITING",
      tokenNumber: { lt: entry.tokenNumber },
    },
  });

  return { peopleAhead, position: peopleAhead + 1 };
}

export type StaffTicketRow = {
  id: string;
  customerName: string;
  tokenLabel: string;
  status: string;
};

export type StaffQueueSnapshot = {
  currentlyServing: StaffTicketRow | null;
  currentlyCalled: StaffTicketRow | null;
  waiting: StaffTicketRow[];
  recentlyCompleted: StaffTicketRow[];
};

function toStaffRow(
  slug: string,
  entry: { id: string; customerName: string; tokenNumber: number; status: string }
): StaffTicketRow {
  return {
    id: entry.id,
    customerName: entry.customerName,
    tokenLabel: formatTicketNumber(slug, entry.tokenNumber),
    status: entry.status,
  };
}

export async function getStaffQueueSnapshot(businessId: string, queueId: string) {
  try {
    const user = await getCurrentUser();
    const { queue } = await getAuthorizedQueueForUser(user, queueId, businessId);

    const [serving, called, waiting, recentlyCompleted] = await Promise.all([
      prisma.queueEntry.findFirst({
        where: { queueId: queue.id, status: "SERVING" },
        orderBy: { tokenNumber: "asc" },
      }),
      prisma.queueEntry.findFirst({
        where: { queueId: queue.id, status: "CALLED" },
        orderBy: { tokenNumber: "asc" },
      }),
      prisma.queueEntry.findMany({
        where: { queueId: queue.id, status: "WAITING" },
        orderBy: { tokenNumber: "asc" },
      }),
      prisma.queueEntry.findMany({
        where: { queueId: queue.id, status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        take: 5,
      }),
    ]);

    return {
      snapshot: {
        currentlyServing: serving ? toStaffRow(queue.slug, serving) : null,
        currentlyCalled: called ? toStaffRow(queue.slug, called) : null,
        waiting: waiting.map((e) => toStaffRow(queue.slug, e)),
        recentlyCompleted: recentlyCompleted.map((e) => toStaffRow(queue.slug, e)),
      } satisfies StaffQueueSnapshot,
    };
  } catch (err) {
    return mapError(err, "getStaffQueueSnapshot");
  }
}

export type PublicTicketSnapshot = {
  businessName: string;
  queueName: string;
  label: string;
  status: string;
  peopleAhead: number;
  position: number;
  currentlyServingLabel: string | null;
  currentlyCalledLabel: string | null;
};

export async function getPublicTicketSnapshot(
  businessId: string,
  queueId: string,
  trackingToken: string
) {
  try {
    const entry = await prisma.queueEntry.findFirst({
      where: {
        trackingToken,
        queueId,
        queue: { businessId },
      },
      select: {
        id: true,
        status: true,
        tokenNumber: true,
        queueId: true,
        queue: {
          select: {
            slug: true,
            name: true,
            business: { select: { name: true } },
          },
        },
      },
    });

    if (!entry) {
      return { error: "This ticket could not be found." };
    }

    const { peopleAhead, position } = await getTicketPosition(entry);

    let currentlyServingLabel: string | null = null;
    let currentlyCalledLabel: string | null = null;

    if (entry.status === "WAITING") {
      const [serving, called] = await Promise.all([
        prisma.queueEntry.findFirst({
          where: { queueId: entry.queueId, status: "SERVING" },
          select: { tokenNumber: true },
          orderBy: { tokenNumber: "asc" },
        }),
        prisma.queueEntry.findFirst({
          where: { queueId: entry.queueId, status: "CALLED" },
          select: { tokenNumber: true },
          orderBy: { tokenNumber: "asc" },
        }),
      ]);

      currentlyServingLabel = serving
        ? formatTicketNumber(entry.queue.slug, serving.tokenNumber)
        : null;
      currentlyCalledLabel = called
        ? formatTicketNumber(entry.queue.slug, called.tokenNumber)
        : null;
    }

    return {
      snapshot: {
        businessName: entry.queue.business.name,
        queueName: entry.queue.name,
        label: formatTicketNumber(entry.queue.slug, entry.tokenNumber),
        status: entry.status,
        peopleAhead,
        position,
        currentlyServingLabel,
        currentlyCalledLabel,
      } satisfies PublicTicketSnapshot,
    };
  } catch (err) {
    return mapError(err, "getPublicTicketSnapshot");
  }
}
