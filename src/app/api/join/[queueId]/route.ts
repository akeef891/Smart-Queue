import { NextRequest, NextResponse } from "next/server";
import { queueJoinSchema } from "@/lib/validations";
import { checkRateLimit } from "@/lib/rate-limit";
import { joinQueue } from "@/lib/actions/ticket";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ queueId: string }> }
) {
  const { queueId } = await params;

  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const rl = checkRateLimit(`join:${ip}:${queueId}`, { max: 5, windowMs: 60_000 });
  if (!rl.allowed) {
    return NextResponse.json(
      { error: "Too many requests. Please wait a moment and try again." },
      { status: 429 }
    );
  }

  const body = await req.json().catch(() => null);
  const parsed = queueJoinSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.issues[0]?.message ?? "Invalid input" },
      { status: 400 }
    );
  }

  const result = await joinQueue({
    queueId,
    customerName: parsed.data.customerName,
    customerPhone: parsed.data.customerPhone,
    customerEmail: parsed.data.customerEmail,
  });

  if ("error" in result && result.error) {
    return NextResponse.json({ error: result.error }, { status: 400 });
  }

  if (!("ticket" in result) || !result.ticket) {
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  return NextResponse.json(
    {
      tokenNumber: result.ticket.tokenNumber,
      trackingUrl: result.ticket.ticketUrl,
      ticketUrl: result.ticket.ticketUrl,
      label: result.ticket.label,
    },
    { status: 201 }
  );
}
