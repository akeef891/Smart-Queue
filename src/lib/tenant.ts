import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth";
import type { User, Workspace, Business, Queue } from "@/generated/prisma";

/**
 * ALL workspace-scoped server code must resolve authorization through this
 * file. Never call `prisma.<model>.findUnique({ where: { id } })` on a
 * tenant-owned model using a client-supplied id alone — always pair it with
 * an authorized workspaceId, resolved here from the session, never from the
 * request body/params.
 */

// Roles are intentionally simple for v1: owner (workspace.ownerId) or staff
// (any user granted membership). Membership table can be added later without
// changing these function signatures.
export type WorkspaceRole = "OWNER" | "STAFF";

export async function getAuthorizedWorkspace(
  user: User,
  workspaceId: string
): Promise<{ workspace: Workspace; role: WorkspaceRole }> {
  const workspace = await prisma.workspace.findFirst({
    where: { id: workspaceId },
  });

  if (!workspace) {
    throw new AuthError("UNAUTHORIZED", "Workspace not found.");
  }

  if (workspace.ownerId === user.id) {
    return { workspace, role: "OWNER" };
  }

  // Placeholder for future WorkspaceMember table lookup.
  throw new AuthError("UNAUTHORIZED", "You do not have access to this workspace.");
}

export async function getAuthorizedBusiness(
  user: User,
  workspaceId: string,
  businessId: string
): Promise<{ workspace: Workspace; business: Business }> {
  const { workspace } = await getAuthorizedWorkspace(user, workspaceId);

  const business = await prisma.business.findFirst({
    where: { id: businessId, workspaceId: workspace.id },
  });

  if (!business) {
    throw new AuthError("UNAUTHORIZED", "Business not found in this workspace.");
  }

  return { workspace, business };
}

export async function getAuthorizedQueue(
  user: User,
  workspaceId: string,
  queueId: string
): Promise<{ workspace: Workspace; queue: Queue }> {
  const { workspace } = await getAuthorizedWorkspace(user, workspaceId);

  const queue = await prisma.queue.findFirst({
    where: { id: queueId, workspaceId: workspace.id },
  });

  if (!queue) {
    throw new AuthError("UNAUTHORIZED", "Queue not found in this workspace.");
  }

  return { workspace, queue };
}

/**
 * All workspaces the current user can access (owner-only for v1).
 */
export async function listAccessibleWorkspaces(user: User): Promise<Workspace[]> {
  return prisma.workspace.findMany({
    where: { ownerId: user.id, status: { not: "DELETED" } },
    orderBy: { createdAt: "desc" },
  });
}

/** Default workspace for v1 (most recently created). */
export async function getCurrentWorkspace(user: User): Promise<Workspace | null> {
  const workspaces = await listAccessibleWorkspaces(user);
  return workspaces[0] ?? null;
}

/**
 * Authorize a business by id using the session user. The business's
 * workspace is loaded from the database — never from the client.
 */
export async function getAuthorizedBusinessForUser(
  user: User,
  businessId: string
): Promise<{ workspace: Workspace; business: Business }> {
  const business = await prisma.business.findFirst({
    where: { id: businessId },
    include: { workspace: true },
  });

  if (!business) {
    throw new AuthError("UNAUTHORIZED", "Business not found.");
  }

  if (business.workspace.ownerId !== user.id || business.workspace.status === "DELETED") {
    throw new AuthError("UNAUTHORIZED", "You do not have access to this business.");
  }

  const { workspace, ...rest } = business;
  return { workspace, business: rest };
}

/**
 * Authorize a queue by id. Workspace and business are loaded from the
 * database. Optional businessId is verified against the queue row, never trusted alone.
 */
export async function getAuthorizedQueueForUser(
  user: User,
  queueId: string,
  businessId?: string
): Promise<{ workspace: Workspace; business: Business; queue: Queue }> {
  const queue = await prisma.queue.findFirst({
    where: { id: queueId },
    include: {
      business: { include: { workspace: true } },
    },
  });

  if (!queue) {
    throw new AuthError("UNAUTHORIZED", "Queue not found.");
  }

  if (queue.business.workspace.ownerId !== user.id || queue.business.workspace.status === "DELETED") {
    throw new AuthError("UNAUTHORIZED", "You do not have access to this queue.");
  }

  if (businessId && queue.businessId !== businessId) {
    throw new AuthError("UNAUTHORIZED", "Queue does not belong to this business.");
  }

  const { business: businessWithWorkspace, ...queueRest } = queue;
  const { workspace, ...businessRest } = businessWithWorkspace;

  return { workspace, business: businessRest, queue: queueRest };
}
