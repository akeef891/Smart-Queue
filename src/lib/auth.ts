import { auth, currentUser } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";
import type { User } from "@/generated/prisma";

/**
 * Resolves the currently signed-in Clerk user to our database User row.
 * Throws if there is no session or if the Clerk user has not yet been
 * synchronized (webhook lag) — callers should treat this as "unauthenticated".
 */
export async function getCurrentUser(): Promise<User> {
  const { userId: clerkId } = await auth();

  if (!clerkId) {
    throw new AuthError("UNAUTHENTICATED", "No active session.");
  }

  let user = await prisma.user.findUnique({ where: { clerkId } });

  // Fallback: if the webhook hasn't landed yet, sync just-in-time so the
  // user isn't blocked. This keeps the webhook as the source of truth
  // while avoiding a race condition on first login.
  if (!user) {
    const clerkUser = await currentUser();
    if (!clerkUser) {
      throw new AuthError("UNAUTHENTICATED", "No active session.");
    }

    const email = clerkUser.emailAddresses.find(
      (e) => e.id === clerkUser.primaryEmailAddressId
    )?.emailAddress;

    if (!email) {
      throw new AuthError("INVALID_STATE", "Clerk user has no primary email.");
    }

    user = await prisma.user.upsert({
      where: { clerkId },
      update: {},
      create: {
        clerkId,
        email,
        displayName:
          [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ") ||
          email,
        avatarUrl: clerkUser.imageUrl,
        emailVerified:
          clerkUser.emailAddresses.find((e) => e.id === clerkUser.primaryEmailAddressId)
            ?.verification?.status === "verified",
      },
    });
  }

  return user;
}

export class AuthError extends Error {
  code: "UNAUTHENTICATED" | "UNAUTHORIZED" | "INVALID_STATE";
  constructor(code: AuthError["code"], message: string) {
    super(message);
    this.code = code;
    this.name = "AuthError";
  }
}
