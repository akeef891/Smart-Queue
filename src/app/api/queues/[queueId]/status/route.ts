import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedQueueForUser } from "@/lib/tenant";
import { queueStatusUpdateSchema } from "@/lib/validations";
import { canTransitionQueue } from "@/lib/queue-state";
import { handleApiError } from "@/app/api/businesses/route";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ queueId: string }> }
) {
  try {
    const { queueId } = await params;
    const user = await getCurrentUser();
    const body = await req.json();
    const parsed = queueStatusUpdateSchema.safeParse({ ...body, queueId });
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { queue } = await getAuthorizedQueueForUser(user, queueId, undefined, "MANAGE");

    if (!canTransitionQueue(queue.status, parsed.data.status)) {
      return NextResponse.json(
        { error: `Cannot transition queue from ${queue.status} to ${parsed.data.status}.` },
        { status: 409 }
      );
    }

    const updated = await prisma.queue.update({
      where: { id: queue.id },
      data: { status: parsed.data.status },
    });

    return NextResponse.json({ queue: updated });
  } catch (err) {
    return handleApiError(err);
  }
}
