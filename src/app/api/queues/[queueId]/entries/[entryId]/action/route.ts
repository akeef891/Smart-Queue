import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedQueueForUser } from "@/lib/tenant";
import { queueEntryActionSchema } from "@/lib/validations";
import { canTransitionEntry } from "@/lib/queue-state";
import { handleApiError } from "@/app/api/businesses/route";
import type { QueueEntryStatus } from "@/generated/prisma";

const ACTION_TARGET_STATUS: Record<string, QueueEntryStatus> = {
  CALL: "CALLED",
  START_SERVING: "SERVING",
  COMPLETE: "COMPLETED",
  SKIP: "SKIPPED",
  CANCEL: "CANCELLED",
  NO_SHOW: "NO_SHOW",
  RECALL: "WAITING",
};

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ queueId: string; entryId: string }> }
) {
  try {
    const { queueId, entryId } = await params;
    const user = await getCurrentUser();
    const body = await req.json();
    const parsed = queueEntryActionSchema.safeParse({ ...body, queueId, entryId });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { queue } = await getAuthorizedQueueForUser(user, queueId, undefined, "OPERATE");

    const entry = await prisma.queueEntry.findFirst({
      where: { id: entryId, queueId: queue.id },
    });
    if (!entry) {
      return NextResponse.json({ error: "Entry not found in this queue." }, { status: 404 });
    }

    const targetStatus = ACTION_TARGET_STATUS[parsed.data.action];
    if (!canTransitionEntry(entry.status, targetStatus)) {
      return NextResponse.json(
        { error: `Cannot transition entry from ${entry.status} to ${targetStatus}.` },
        { status: 409 }
      );
    }

    const now = new Date();
    const timestampField =
      targetStatus === "CALLED"
        ? { calledAt: now }
        : targetStatus === "SERVING"
          ? { servingAt: now }
          : targetStatus === "COMPLETED"
            ? { completedAt: now }
            : targetStatus === "CANCELLED"
              ? { cancelledAt: now }
              : {};

    const updated = await prisma.$transaction(async (tx) => {
      const updatedEntry = await tx.queueEntry.update({
        where: { id: entry.id },
        data: { status: targetStatus, ...timestampField },
      });

      if (targetStatus === "COMPLETED") {
        await tx.queue.update({
          where: { id: queue.id },
          data: { totalServed: { increment: 1 } },
        });
      }

      return updatedEntry;
    });

    return NextResponse.json({ entry: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
