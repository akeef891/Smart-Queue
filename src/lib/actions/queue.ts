"use server";

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { getAuthorizedBusinessForUser, getAuthorizedQueueForUser } from "@/lib/tenant";
import { queueManageSchema } from "@/lib/validations";
import { slugify } from "@/lib/slug";
import { revalidatePath } from "next/cache";

async function uniqueQueueSlug(businessId: string, base: string, excludeId?: string): Promise<string> {
  for (let n = 0; n < 25; n += 1) {
    const slug = n === 0 ? base : `${base.slice(0, 50 - String(n).length - 1)}-${n}`;
    const taken = await prisma.queue.findFirst({
      where: {
        businessId,
        slug,
        ...(excludeId ? { id: { not: excludeId } } : {}),
      },
      select: { id: true },
    });
    if (!taken) return slug;
  }

  return `${base.slice(0, 40)}-${crypto.randomUUID().slice(0, 8)}`;
}

function mapQueueError(err: unknown, action: string): { error: string } {
  if (err instanceof AuthError) {
    if (err.code === "UNAUTHENTICATED") {
      return { error: "Please sign in to continue." };
    }
    return { error: "You do not have permission to manage this queue." };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return { error: "A queue with that name already exists for this business." };
    }
    if (err.code === "P2003") {
      return { error: "This queue cannot be deleted while related records still exist." };
    }
    return { error: "We couldn't save the queue. Please try again." };
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

function revalidateQueuePaths(businessId: string, queueId?: string) {
  try {
    revalidatePath("/dashboard");
    revalidatePath("/businesses");
    revalidatePath(`/businesses/${businessId}`);
    if (queueId) {
      revalidatePath(`/businesses/${businessId}/queues/${queueId}`);
    }
  } catch {
    // Ignored in non-Next.js request contexts
  }
}

async function duplicateQueueName(
  businessId: string,
  name: string,
  excludeId?: string
) {
  return prisma.queue.findFirst({
    where: {
      businessId,
      name: { equals: name, mode: "insensitive" },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
}

export async function createQueue(input: unknown) {
  try {
    const user = await getCurrentUser();
    const raw = input as { businessId?: unknown };
    if (typeof raw?.businessId !== "string") {
      return { error: "Select a business before creating a queue." };
    }

    const { business, workspace } = await getAuthorizedBusinessForUser(
      user,
      raw.businessId,
      "OWNER"
    );

    const parsed = queueManageSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Enter a valid queue name." };
    }

    if (await duplicateQueueName(business.id, parsed.data.name)) {
      return { error: "A queue with that name already exists for this business." };
    }

    const slug = await uniqueQueueSlug(business.id, slugify(parsed.data.name, "queue"));
    const description = parsed.data.description?.trim() || undefined;

    const queue = await prisma.queue.create({
      data: {
        workspaceId: workspace.id,
        businessId: business.id,
        name: parsed.data.name,
        slug,
        description,
        status: "ACTIVE",
        createdById: user.id,
      },
    });

    revalidateQueuePaths(business.id, queue.id);
    return { queue };
  } catch (err) {
    return mapQueueError(err, "createQueue");
  }
}

export async function getQueues(businessId: string) {
  try {
    const user = await getCurrentUser();
    const { business, role, assignedQueueIds } = await getAuthorizedBusinessForUser(user, businessId);

    let queues = await prisma.queue.findMany({
      where: { businessId: business.id },
      orderBy: { createdAt: "desc" },
    });

    if (role === "STAFF") {
      const assignedSet = new Set(assignedQueueIds);
      queues = queues.filter((q) => assignedSet.has(q.id));
    }

    return { queues };
  } catch (err) {
    return mapQueueError(err, "getQueues");
  }
}

export async function getQueueById(businessId: string, queueId: string) {
  try {
    const user = await getCurrentUser();
    const result = await getAuthorizedQueueForUser(user, queueId, businessId);
    return result;
  } catch (err) {
    return mapQueueError(err, "getQueueById");
  }
}

export async function updateQueue(input: unknown) {
  try {
    const user = await getCurrentUser();
    const raw = input as { businessId?: unknown; queueId?: unknown };
    if (typeof raw?.businessId !== "string" || typeof raw?.queueId !== "string") {
      return { error: "Queue could not be updated." };
    }

    const { queue, business } = await getAuthorizedQueueForUser(
      user,
      raw.queueId,
      raw.businessId,
      "MANAGE"
    );

    const parsed = queueManageSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Enter a valid queue name." };
    }

    if (await duplicateQueueName(business.id, parsed.data.name, queue.id)) {
      return { error: "A queue with that name already exists for this business." };
    }

    const description = parsed.data.description?.trim() || null;
    const slug =
      parsed.data.name !== queue.name
        ? await uniqueQueueSlug(business.id, slugify(parsed.data.name, "queue"), queue.id)
        : queue.slug;

    const updated = await prisma.queue.update({
      where: { id: queue.id },
      data: {
        name: parsed.data.name,
        description,
        slug,
      },
    });

    revalidateQueuePaths(business.id, queue.id);
    return { queue: updated };
  } catch (err) {
    return mapQueueError(err, "updateQueue");
  }
}

export async function updateQueueStatus(input: unknown) {
  try {
    const user = await getCurrentUser();
    const raw = input as { businessId?: unknown; queueId?: unknown; status?: unknown };
    if (typeof raw?.businessId !== "string" || typeof raw?.queueId !== "string") {
      return { error: "Queue status could not be updated." };
    }
    if (raw.status !== "ACTIVE" && raw.status !== "INACTIVE") {
      return { error: "Choose Activate or Deactivate." };
    }

    const { queue, business } = await getAuthorizedQueueForUser(
      user,
      raw.queueId,
      raw.businessId,
      "MANAGE"
    );

    const updated = await prisma.queue.update({
      where: { id: queue.id },
      data: { status: raw.status },
    });

    revalidateQueuePaths(business.id, queue.id);
    return { queue: updated };
  } catch (err) {
    return mapQueueError(err, "updateQueueStatus");
  }
}

export async function deleteQueue(input: unknown) {
  try {
    const user = await getCurrentUser();
    const raw = input as { businessId?: unknown; queueId?: unknown };
    if (typeof raw?.businessId !== "string" || typeof raw?.queueId !== "string") {
      return { error: "Queue could not be deleted." };
    }

    const { queue, business } = await getAuthorizedQueueForUser(
      user,
      raw.queueId,
      raw.businessId,
      "MANAGE"
    );

    const activeCustomers = await prisma.queueEntry.count({
      where: {
        queueId: queue.id,
        status: { in: ["WAITING", "CALLED", "SERVING"] },
      },
    });

    if (activeCustomers > 0) {
      return {
        error: "This queue still has customers in line. Finish or cancel them before deleting.",
      };
    }

    await prisma.queue.delete({ where: { id: queue.id } });

    revalidateQueuePaths(business.id);
    return { ok: true as const };
  } catch (err) {
    return mapQueueError(err, "deleteQueue");
  }
}
