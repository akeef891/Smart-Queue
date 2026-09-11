import { prisma } from "@/lib/prisma";
import { notFound, redirect } from "next/navigation";

export default async function TrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const entry = await prisma.queueEntry.findUnique({
    where: { trackingToken: token },
    select: {
      trackingToken: true,
      queueId: true,
      queue: { select: { businessId: true } },
    },
  });

  if (!entry) notFound();

  redirect(
    `/businesses/${entry.queue.businessId}/queues/${entry.queueId}/ticket/${entry.trackingToken}`
  );
}
