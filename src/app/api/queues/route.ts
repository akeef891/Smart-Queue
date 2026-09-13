import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { getAuthorizedWorkspace, getAuthorizedBusinessForUser } from "@/lib/tenant";
import { queueCreateSchema } from "@/lib/validations";
import { handleApiError } from "@/app/api/businesses/route";
import { slugify } from "@/lib/slug";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const parsed = queueCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Verify user is an OWNER of this business before allowing queue creation
    const { business, workspace } = await getAuthorizedBusinessForUser(
      user,
      parsed.data.businessId,
      "OWNER"
    );

    if (parsed.data.workspaceId && workspace.id !== parsed.data.workspaceId) {
      return NextResponse.json({ error: "Workspace mismatch" }, { status: 403 });
    }

    const base = slugify(parsed.data.name, "queue");
    let slug = base;
    for (let n = 0; n < 25; n += 1) {
      slug = n === 0 ? base : `${base.slice(0, 50 - String(n).length - 1)}-${n}`;
      const taken = await prisma.queue.findFirst({
        where: { businessId: business.id, slug },
        select: { id: true },
      });
      if (!taken) break;
      if (n === 24) {
        slug = `${base.slice(0, 40)}-${crypto.randomUUID().slice(0, 8)}`;
      }
    }

    const queue = await prisma.queue.create({
      data: {
        workspaceId: business.workspaceId,
        businessId: business.id,
        name: parsed.data.name,
        slug,
        description: parsed.data.description,
        averageServiceTime: parsed.data.averageServiceTime,
        maxCapacity: parsed.data.maxCapacity,
        createdById: user.id,
        status: "ACTIVE",
      },
    });

    return NextResponse.json({ queue }, { status: 201 });
  } catch (err) {
    return handleApiError(err);
  }
}

export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const workspaceId = req.nextUrl.searchParams.get("workspaceId");
    if (!workspaceId) {
      return NextResponse.json({ error: "workspaceId is required" }, { status: 400 });
    }
    const { workspace } = await getAuthorizedWorkspace(user, workspaceId);

    const queues = await prisma.queue.findMany({
      where: { workspaceId: workspace.id },
      include: {
        business: { select: { name: true } },
        _count: { select: { queueEntries: { where: { status: "WAITING" } } } },
      },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ queues });
  } catch (err) {
    return handleApiError(err);
  }
}
