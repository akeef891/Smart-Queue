"use server";

import { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/prisma";
import { AuthError, getCurrentUser } from "@/lib/auth";
import { listAccessibleWorkspaces } from "@/lib/tenant";
import { workspaceCreateSchema } from "@/lib/validations";
import { slugify } from "@/lib/slug";
import { revalidatePath } from "next/cache";

async function uniqueSlug(base: string): Promise<string> {
  for (let n = 0; n < 25; n += 1) {
    const slug = n === 0 ? base : `${base.slice(0, 50 - String(n).length - 1)}-${n}`;
    const taken = await prisma.workspace.findUnique({ where: { slug }, select: { id: true } });
    if (!taken) return slug;
  }

  return `${base.slice(0, 40)}-${crypto.randomUUID().slice(0, 8)}`;
}

function mapCreateError(err: unknown): { error: string } {
  if (err instanceof AuthError) {
    if (err.code === "UNAUTHENTICATED") {
      return { error: "Please sign in to create a workspace." };
    }
    return { error: "You do not have permission to create a workspace." };
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === "P2002") {
      return { error: "A workspace with that name already exists. Try a different name." };
    }
    return { error: "We couldn't save your workspace. Please try again." };
  }

  if (
    err instanceof Prisma.PrismaClientInitializationError ||
    err instanceof Prisma.PrismaClientRustPanicError
  ) {
    return { error: "We're having trouble connecting to the database. Please try again in a moment." };
  }

  console.error("createWorkspace failed:", err instanceof Error ? err.name : "unknown");
  return { error: "Something went wrong. Please try again." };
}

export async function createWorkspace(input: unknown) {
  try {
    const user = await getCurrentUser();

    const parsed = workspaceCreateSchema.safeParse(input);
    if (!parsed.success) {
      const first = parsed.error.issues[0]?.message ?? "Enter a valid workspace name.";
      return { error: first };
    }

    const existing = await listAccessibleWorkspaces(user);
    if (existing.length > 0) {
      revalidatePath("/dashboard");
      return { workspace: existing[0] };
    }

    const slug = await uniqueSlug(slugify(parsed.data.name, "workspace"));

    const workspace = await prisma.workspace.create({
      data: {
        name: parsed.data.name,
        slug,
        ownerId: user.id,
        status: "ACTIVE",
      },
    });

    revalidatePath("/dashboard");
    return { workspace };
  } catch (err) {
    return mapCreateError(err);
  }
}
