"use server";

import { prisma } from "@/lib/prisma";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { getAuthorizedBusinessForUser, type BusinessRole } from "@/lib/tenant";
import { revalidatePath } from "next/cache";
import { z } from "zod";

const addStaffSchema = z.object({
  businessId: z.string().min(1, "Business ID is required."),
  email: z.string().email("Please enter a valid email address."),
  role: z.enum(["MANAGER", "STAFF"]),
  queueIds: z.array(z.string()).optional(),
});

const updateStaffSchema = z.object({
  businessId: z.string().min(1, "Business ID is required."),
  memberId: z.string().min(1, "Member ID is required."),
  role: z.enum(["MANAGER", "STAFF"]),
  queueIds: z.array(z.string()).optional(),
});

const removeStaffSchema = z.object({
  businessId: z.string().min(1, "Business ID is required."),
  memberId: z.string().min(1, "Member ID is required."),
});

function revalidateStaffPaths(businessId: string) {
  try {
    revalidatePath(`/businesses/${businessId}/staff`);
    revalidatePath(`/businesses/${businessId}`);
  } catch {
    // Ignored in non-Next.js request contexts
  }
}

export type StaffMemberRecord = {
  id: string;
  email: string;
  role: BusinessRole;
  status: "ACTIVE" | "INVITED";
  isOwner: boolean;
  displayName: string | null;
  avatarUrl: string | null;
  assignedQueues: { id: string; name: string }[];
  createdAt: string;
};

export async function getBusinessStaff(businessId: string): Promise<{
  members?: StaffMemberRecord[];
  allQueues?: { id: string; name: string }[];
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    const { business, workspace } = await getAuthorizedBusinessForUser(
      user,
      businessId,
      "OWNER"
    );

    // Fetch workspace owner info
    const ownerUser = await prisma.user.findUnique({
      where: { id: workspace.ownerId },
    });

    // Fetch all queues for this business
    const queues = await prisma.queue.findMany({
      where: { businessId: business.id },
      select: { id: true, name: true },
      orderBy: { createdAt: "asc" },
    });

    // Fetch all business members
    const rawMembers = await prisma.businessMember.findMany({
      where: { businessId: business.id },
      include: {
        user: { select: { displayName: true, avatarUrl: true, email: true } },
        queueAssignments: {
          include: { queue: { select: { id: true, name: true } } },
        },
      },
      orderBy: { createdAt: "asc" },
    });

    const members: StaffMemberRecord[] = [];

    // First, represent the Owner
    if (ownerUser) {
      members.push({
        id: `owner-${ownerUser.id}`,
        email: ownerUser.email,
        role: "OWNER",
        status: "ACTIVE",
        isOwner: true,
        displayName: ownerUser.displayName,
        avatarUrl: ownerUser.avatarUrl,
        assignedQueues: queues,
        createdAt: business.createdAt.toISOString(),
      });
    }

    // Next, the invited or active members
    for (const m of rawMembers) {
      // Avoid duplicating if owner was also added as a member
      if (m.userId && m.userId === workspace.ownerId) continue;
      if (m.email.toLowerCase() === ownerUser?.email.toLowerCase()) continue;

      members.push({
        id: m.id,
        email: m.email,
        role: m.role,
        status: m.status,
        isOwner: false,
        displayName: m.user?.displayName ?? null,
        avatarUrl: m.user?.avatarUrl ?? null,
        assignedQueues:
          m.role === "MANAGER"
            ? queues
            : m.queueAssignments.map((qa) => ({
                id: qa.queue.id,
                name: qa.queue.name,
              })),
        createdAt: m.createdAt.toISOString(),
      });
    }

    return { members, allQueues: queues };
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: err.message };
    }
    console.error("getBusinessStaff error:", err);
    return { error: "Staff list could not be loaded. Please try again." };
  }
}

export async function addStaffMember(input: unknown): Promise<{
  ok?: boolean;
  memberId?: string;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    const parsed = addStaffSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid staff details." };
    }

    const { business, workspace } = await getAuthorizedBusinessForUser(
      user,
      parsed.data.businessId,
      "OWNER"
    );

    const email = parsed.data.email.trim().toLowerCase();

    // Check if adding the owner
    const ownerUser = await prisma.user.findUnique({
      where: { id: workspace.ownerId },
    });
    if (ownerUser && ownerUser.email.toLowerCase() === email) {
      return { error: "That user is already the owner of this business." };
    }

    // Check for duplicate membership
    const existingMember = await prisma.businessMember.findUnique({
      where: {
        businessId_email: {
          businessId: business.id,
          email,
        },
      },
    });

    if (existingMember) {
      return { error: "This email is already a team member of this business." };
    }

    // Check if an existing User row exists for this email
    const matchedUser = await prisma.user.findUnique({
      where: { email },
    });

    const queueIds = parsed.data.queueIds ?? [];

    // Verify all queueIds belong to this business
    if (parsed.data.role === "STAFF" && queueIds.length > 0) {
      const validQueuesCount = await prisma.queue.count({
        where: { businessId: business.id, id: { in: queueIds } },
      });
      if (validQueuesCount !== queueIds.length) {
        return { error: "One or more selected queues do not belong to this business." };
      }
    }

    const member = await prisma.$transaction(async (tx) => {
      const newMember = await tx.businessMember.create({
        data: {
          businessId: business.id,
          userId: matchedUser?.id ?? null,
          email,
          role: parsed.data.role,
          status: matchedUser ? "ACTIVE" : "INVITED",
        },
      });

      if (parsed.data.role === "STAFF" && queueIds.length > 0) {
        await tx.staffQueueAssignment.createMany({
          data: queueIds.map((queueId) => ({
            memberId: newMember.id,
            queueId,
          })),
        });
      }

      return newMember;
    }, { maxWait: 10000, timeout: 20000 });

    revalidateStaffPaths(business.id);
    return { ok: true, memberId: member.id };
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: err.message };
    }
    console.error("addStaffMember error:", err);
    return { error: "Could not add staff member. Please try again." };
  }
}

export async function updateStaffMember(input: unknown): Promise<{
  ok?: boolean;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    const parsed = updateStaffSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid update parameters." };
    }

    const { business, workspace } = await getAuthorizedBusinessForUser(
      user,
      parsed.data.businessId,
      "OWNER"
    );

    const member = await prisma.businessMember.findFirst({
      where: { id: parsed.data.memberId, businessId: business.id },
    });

    if (!member) {
      return { error: "Staff member not found." };
    }

    // Protect owner from demotion or role modification
    const ownerUser = await prisma.user.findUnique({
      where: { id: workspace.ownerId },
    });
    if (
      member.userId === workspace.ownerId ||
      member.userId === user.id ||
      (ownerUser && member.email.toLowerCase() === ownerUser.email.toLowerCase())
    ) {
      return { error: "The business owner cannot be demoted or have their role modified." };
    }

    const queueIds = parsed.data.queueIds ?? [];

    if (parsed.data.role === "STAFF" && queueIds.length > 0) {
      const validQueuesCount = await prisma.queue.count({
        where: { businessId: business.id, id: { in: queueIds } },
      });
      if (validQueuesCount !== queueIds.length) {
        return { error: "One or more selected queues do not belong to this business." };
      }
    }

    await prisma.$transaction(async (tx) => {
      await tx.businessMember.update({
        where: { id: member.id },
        data: { role: parsed.data.role },
      });

      // Clear previous queue assignments
      await tx.staffQueueAssignment.deleteMany({
        where: { memberId: member.id },
      });

      // Re-assign if role is STAFF
      if (parsed.data.role === "STAFF" && queueIds.length > 0) {
        await tx.staffQueueAssignment.createMany({
          data: queueIds.map((queueId) => ({
            memberId: member.id,
            queueId,
          })),
        });
      }
    }, { maxWait: 10000, timeout: 20000 });

    revalidateStaffPaths(business.id);
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: err.message };
    }
    console.error("updateStaffMember error:", err);
    return { error: "Could not update staff member. Please try again." };
  }
}

export async function removeStaffMember(input: unknown): Promise<{
  ok?: boolean;
  error?: string;
}> {
  try {
    const user = await getCurrentUser();
    const parsed = removeStaffSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Invalid parameters." };
    }

    const { business, workspace } = await getAuthorizedBusinessForUser(
      user,
      parsed.data.businessId,
      "OWNER"
    );

    const member = await prisma.businessMember.findFirst({
      where: { id: parsed.data.memberId, businessId: business.id },
    });

    if (!member) {
      return { error: "Staff member not found." };
    }

    // Protect owner: Cannot remove self or workspace owner
    const ownerUser = await prisma.user.findUnique({
      where: { id: workspace.ownerId },
    });
    if (
      member.userId === workspace.ownerId ||
      member.userId === user.id ||
      (ownerUser && member.email.toLowerCase() === ownerUser.email.toLowerCase())
    ) {
      return { error: "The business owner cannot be removed." };
    }

    await prisma.businessMember.delete({
      where: { id: member.id },
    });

    revalidateStaffPaths(business.id);
    return { ok: true };
  } catch (err) {
    if (err instanceof AuthError) {
      return { error: err.message };
    }
    console.error("removeStaffMember error:", err);
    return { error: "Could not remove staff member. Please try again." };
  }
}
