import { NextRequest, NextResponse } from "next/server";
import { Webhook } from "svix";
import { prisma } from "@/lib/prisma";

type ClerkUserEvent = {
  type: string;
  data: {
    id: string;
    email_addresses: { id: string; email_address: string; verification?: { status?: string } }[];
    primary_email_address_id: string | null;
    first_name: string | null;
    last_name: string | null;
    image_url: string | null;
  };
};

export async function POST(req: NextRequest) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    console.error("CLERK_WEBHOOK_SECRET is not configured.");
    return NextResponse.json({ error: "Server misconfigured" }, { status: 500 });
  }

  const svixId = req.headers.get("svix-id");
  const svixTimestamp = req.headers.get("svix-timestamp");
  const svixSignature = req.headers.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const payload = await req.text();
  const wh = new Webhook(secret);

  let event: ClerkUserEvent;
  try {
    event = wh.verify(payload, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  if (event.type === "user.created" || event.type === "user.updated") {
    const { id, email_addresses, primary_email_address_id, first_name, last_name, image_url } =
      event.data;

    const primaryEmail = email_addresses.find((e) => e.id === primary_email_address_id);
    if (!primaryEmail) {
      return NextResponse.json({ error: "No primary email on Clerk user" }, { status: 400 });
    }

    // upsert on clerkId keeps this idempotent: replayed/duplicate webhook
    // deliveries never create a second User row for the same Clerk identity.
    await prisma.user.upsert({
      where: { clerkId: id },
      update: {
        email: primaryEmail.email_address,
        displayName: [first_name, last_name].filter(Boolean).join(" ") || primaryEmail.email_address,
        avatarUrl: image_url,
        emailVerified: primaryEmail.verification?.status === "verified",
      },
      create: {
        clerkId: id,
        email: primaryEmail.email_address,
        displayName: [first_name, last_name].filter(Boolean).join(" ") || primaryEmail.email_address,
        avatarUrl: image_url,
        emailVerified: primaryEmail.verification?.status === "verified",
      },
    });
  }

  if (event.type === "user.deleted") {
    // Soft-handling: we don't hard-delete because Workspace.ownerId
    // restricts deletion while workspaces exist. Mark for review instead
    // in a real system (e.g. flag / anonymize). No-op placeholder here.
  }

  return NextResponse.json({ received: true });
}
