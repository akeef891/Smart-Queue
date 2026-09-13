"use server";

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { AuthError, getCurrentUser } from "@/lib/auth";
import {
  getAuthorizedBusinessForUser,
  getCurrentWorkspace,
  listAccessibleBusinessesForUser,
} from "@/lib/tenant";
import { businessManageSchema } from "@/lib/validations";
import { slugify } from "@/lib/slug";
import { revalidatePath } from "next/cache";

async function uniqueBusinessSlug(workspaceId: string, base: string): Promise<string> {
  for (let n = 0; n < 25; n += 1) {
    const slug = n === 0 ? base : `${base.slice(0, 50 - String(n).length - 1)}-${n}`;
    const taken = await prisma.business.findFirst({
      where: { workspaceId, slug },
      select: { id: true },
    });
    if (!taken) return slug;
  }

  return `${base.slice(0, 40)}-${crypto.randomUUID().slice(0, 8)}`;
}

function mapBusinessError(err: unknown, action: string): { error: string } {
  if (err instanceof AuthError) {
    if (err.code === "UNAUTHENTICATED") {
      return { error: "Please sign in to continue." };
    }
    return { error: "You do not have permission to manage this business." };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return { error: "A business with that name already exists in this workspace." };
    }
    return { error: "We couldn't save the business. Please try again." };
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

function revalidateBusinessPaths(businessId?: string) {
  revalidatePath("/dashboard");
  revalidatePath("/businesses");
  if (businessId) {
    revalidatePath(`/businesses/${businessId}`);
  }
}

export async function createBusiness(input: unknown) {
  try {
    const user = await getCurrentUser();
    const workspace = await getCurrentWorkspace(user);

    if (!workspace) {
      return { error: "Create a workspace before adding a business." };
    }

    const parsed = businessManageSchema.safeParse(input);
    if (!parsed.success) {
      return { error: parsed.error.issues[0]?.message ?? "Enter a valid business name." };
    }

    const description = parsed.data.description?.trim() || undefined;

    const duplicateName = await prisma.business.findFirst({
      where: {
        workspaceId: workspace.id,
        name: { equals: parsed.data.name, mode: "insensitive" },
      },
      select: { id: true },
    });

    if (duplicateName) {
      return { error: "A business with that name already exists in this workspace." };
    }

    const slug = await uniqueBusinessSlug(workspace.id, slugify(parsed.data.name, "business"));

    const business = await prisma.business.create({
      data: {
        workspaceId: workspace.id,
        name: parsed.data.name,
        slug,
        description,
        status: "ACTIVE",
      },
    });

    revalidateBusinessPaths(business.id);
    return { business };
  } catch (err) {
    return mapBusinessError(err, "createBusiness");
  }
}

export async function getBusinesses() {
  try {
    const user = await getCurrentUser();
    const businesses = await listAccessibleBusinessesForUser(user);
    return { businesses };
  } catch (err) {
    return mapBusinessError(err, "getBusinesses");
  }
}

export async function getBusinessById(businessId: string) {
  try {
    const user = await getCurrentUser();
    const { business, workspace } = await getAuthorizedBusinessForUser(user, businessId);
    return { business, workspace };
  } catch (err) {
    return mapBusinessError(err, "getBusinessById");
  }
}
