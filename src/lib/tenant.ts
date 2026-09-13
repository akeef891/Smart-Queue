import { prisma } from "@/lib/prisma";
import { AuthError } from "@/lib/auth";
import type { User, Workspace, Business, Queue, BusinessRole } from "@/generated/prisma";

export type { BusinessRole };

export type WorkspaceRole = "OWNER" | "STAFF";

export function hasSufficientRole(
  actualRole: BusinessRole,
  requiredRole: BusinessRole
): boolean {
  if (actualRole === "OWNER") return true;
  if (actualRole === "MANAGER") return requiredRole === "MANAGER" || requiredRole === "STAFF";
  if (actualRole === "STAFF") return requiredRole === "STAFF";
  return false;
}

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
 * All businesses the user can access either as a workspace owner (OWNER)
 * or as an invited/active team member (MANAGER or STAFF).
 */
export async function listAccessibleBusinessesForUser(user: User) {
  const userEmail = user.email.toLowerCase();
  const businesses = await prisma.business.findMany({
    where: {
      OR: [
        { workspace: { ownerId: user.id, status: { not: "DELETED" } } },
        {
          members: {
            some: {
              OR: [
                { userId: user.id },
                { email: { equals: userEmail, mode: "insensitive" } },
              ],
            },
          },
        },
      ],
      status: { not: "ARCHIVED" },
    },
    orderBy: { createdAt: "desc" },
    include: {
      _count: { select: { queues: true } },
      workspace: { select: { id: true, name: true, ownerId: true } },
      members: {
        where: {
          OR: [
            { userId: user.id },
            { email: { equals: userEmail, mode: "insensitive" } },
          ],
        },
        select: { id: true, role: true, status: true, userId: true },
      },
    },
  });

  return businesses.map((b) => {
    const isOwner = b.workspace.ownerId === user.id;
    const member = b.members[0];
    const role: BusinessRole = isOwner ? "OWNER" : member?.role ?? "STAFF";
    return {
      ...b,
      role,
    };
  });
}

/**
 * Authorize a business by id using the session user.
 * Resolves role (OWNER, MANAGER, STAFF) and enforces minimum role requirements.
 */
export async function getAuthorizedBusinessForUser(
  user: User,
  businessId: string,
  minRole: BusinessRole = "STAFF"
): Promise<{
  workspace: Workspace;
  business: Business;
  role: BusinessRole;
  memberId?: string;
  assignedQueueIds: string[];
}> {
  const userEmail = user.email.toLowerCase();

  const business = await prisma.business.findFirst({
    where: { id: businessId },
    include: {
      workspace: true,
      members: {
        where: {
          OR: [
            { userId: user.id },
            { email: { equals: userEmail, mode: "insensitive" } },
          ],
        },
        include: { queueAssignments: true },
      },
    },
  });

  if (!business || business.workspace.status === "DELETED") {
    throw new AuthError("UNAUTHORIZED", "Business not found.");
  }

  const isWorkspaceOwner = business.workspace.ownerId === user.id;
  let role: BusinessRole;
  let memberId: string | undefined;
  let assignedQueueIds: string[] = [];

  if (isWorkspaceOwner) {
    role = "OWNER";
  } else {
    const member = business.members[0];
    if (!member) {
      throw new AuthError("UNAUTHORIZED", "You do not have access to this business.");
    }

    // If the membership record is already bound to another user ID, reject
    if (member.userId && member.userId !== user.id) {
      throw new AuthError("UNAUTHORIZED", "Membership is bound to a different user.");
    }

    // Auto-link userId and activate if this user accepted an invite via matching email
    if (!member.userId || member.status !== "ACTIVE") {
      await prisma.businessMember.update({
        where: { id: member.id },
        data: { userId: user.id, status: "ACTIVE" },
      });
      member.userId = user.id;
      member.status = "ACTIVE";
    }

    role = member.role;
    memberId = member.id;
    assignedQueueIds = member.queueAssignments.map((a) => a.queueId);
  }

  if (!hasSufficientRole(role, minRole)) {
    throw new AuthError("UNAUTHORIZED", `This action requires ${minRole} permissions.`);
  }

  const { workspace, members: _members, ...rest } = business;
  return { workspace, business: rest, role, memberId, assignedQueueIds };
}

/**
 * Authorize a queue by id.
 * - Ensures business and workspace authorization
 * - For STAFF: verifies that the queue is in the staff member's assignedQueueIds
 * - For MANAGE action (updating settings, deleting): enforces OWNER role only
 */
export async function getAuthorizedQueueForUser(
  user: User,
  queueId: string,
  businessId?: string,
  action: "OPERATE" | "MANAGE" = "OPERATE"
): Promise<{
  workspace: Workspace;
  business: Business;
  queue: Queue;
  role: BusinessRole;
}> {
  const queue = await prisma.queue.findFirst({
    where: { id: queueId },
    include: {
      business: { include: { workspace: true } },
    },
  });

  if (!queue) {
    throw new AuthError("UNAUTHORIZED", "Queue not found.");
  }

  if (businessId && queue.businessId !== businessId) {
    throw new AuthError("UNAUTHORIZED", "Queue does not belong to this business.");
  }

  const { workspace, business, role, assignedQueueIds } =
    await getAuthorizedBusinessForUser(user, queue.businessId, "STAFF");

  if (action === "MANAGE") {
    if (role !== "OWNER") {
      throw new AuthError("UNAUTHORIZED", "Only business owners can modify queue settings.");
    }
  } else if (role === "STAFF") {
    // Staff can only operate queues they are explicitly assigned to
    if (!assignedQueueIds.includes(queue.id)) {
      throw new AuthError("UNAUTHORIZED", "You are not assigned to operate this queue.");
    }
  }

  const { business: _businessWithWorkspace, ...queueRest } = queue;
  return { workspace, business, queue: queueRest, role };
}
