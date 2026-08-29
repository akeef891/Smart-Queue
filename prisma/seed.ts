import { PrismaClient } from "../src/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  // NOTE: replace clerkId/email with a real Clerk user id from your dev
  // instance if you want to log in as this seeded account.
  const user = await prisma.user.upsert({
    where: { clerkId: "seed_dev_user" },
    update: {},
    create: {
      clerkId: "seed_dev_user",
      email: "owner@example.com",
      displayName: "Demo Owner",
      emailVerified: true,
    },
  });

  const workspace = await prisma.workspace.upsert({
    where: { slug: "demo-clinic" },
    update: {},
    create: {
      name: "Demo Clinic Group",
      slug: "demo-clinic",
      ownerId: user.id,
      status: "ACTIVE",
      subscriptionPlan: "FREE",
    },
  });

  const business = await prisma.business.create({
    data: {
      workspaceId: workspace.id,
      name: "Downtown Clinic",
      slug: "downtown-clinic",
      type: "CLINIC",
      timezone: "America/New_York",
      status: "ACTIVE",
    },
  });

  await prisma.queue.create({
    data: {
      workspaceId: workspace.id,
      businessId: business.id,
      name: "General Consultation",
      slug: "general-consultation",
      status: "ACTIVE",
      averageServiceTime: 12,
      createdById: user.id,
    },
  });

  console.log("Seeded:", { workspace: workspace.slug, business: business.name });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
