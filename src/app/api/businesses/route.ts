import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser, AuthError } from "@/lib/auth";
import { getAuthorizedWorkspace } from "@/lib/tenant";
import { businessCreateSchema } from "@/lib/validations";
import { slugify } from "@/lib/slug";

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    const body = await req.json();
    const parsed = businessCreateSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    // Authorization resolved from the session-derived user, not trusted
    // solely because the client sent a workspaceId.
    const { workspace } = await getAuthorizedWorkspace(user, parsed.data.workspaceId);

    const base = slugify(parsed.data.name, "business");
    let slug = base;
    for (let n = 0; n < 25; n += 1) {
      slug = n === 0 ? base : `${base.slice(0, 50 - String(n).length - 1)}-${n}`;
      const taken = await prisma.business.findFirst({
        where: { workspaceId: workspace.id, slug },
        select: { id: true },
      });
      if (!taken) break;
      if (n === 24) {
        slug = `${base.slice(0, 40)}-${crypto.randomUUID().slice(0, 8)}`;
      }
    }

    const business = await prisma.business.create({
      data: {
        workspaceId: workspace.id,
        name: parsed.data.name,
        slug,
        description: parsed.data.description,
        type: parsed.data.type,
        phone: parsed.data.phone,
        address: parsed.data.address,
        logoUrl: parsed.data.logoUrl,
        timezone: parsed.data.timezone,
      },
    });

    return NextResponse.json({ business }, { status: 201 });
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
    const businesses = await prisma.business.findMany({
      where: { workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
    });

    return NextResponse.json({ businesses });
  } catch (err) {
    return handleApiError(err);
  }
}

export function handleApiError(err: unknown) {
  if (err instanceof AuthError) {
    const status = err.code === "UNAUTHENTICATED" ? 401 : 403;
    return NextResponse.json({ error: err.message }, { status });
  }
  console.error(err);
  return NextResponse.json({ error: "Internal server error" }, { status: 500 });
}
