import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { JoinForm } from "@/components/customer/join-form";

export default async function JoinQueuePage({
  params,
}: {
  params: Promise<{ queueId: string }>;
}) {
  const { queueId } = await params;

  const queue = await prisma.queue.findUnique({
    where: { id: queueId },
    include: { business: { select: { name: true } } },
  });

  if (!queue) notFound();

  const waitingCount = await prisma.queueEntry.count({
    where: { queueId: queue.id, status: "WAITING" },
  });

  const canJoin = queue.status === "OPEN" || queue.status === "ACTIVE";
  const estimatedWait = (waitingCount + 1) * queue.averageServiceTime;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <p className="text-sm text-slate-500">{queue.business.name}</p>
      <h1 className="text-2xl font-semibold">{queue.name}</h1>

      {!canJoin ? (
        <p className="mt-6 rounded-lg border bg-amber-50 p-4 text-sm text-amber-800">
          This queue isn&apos;t accepting customers right now. Please check back later.
        </p>
      ) : (
        <>
          <div className="mt-4 flex gap-6 text-sm text-slate-600">
            <span>{waitingCount} waiting</span>
            <span>~{estimatedWait} min estimated wait</span>
          </div>
          <div className="mt-6">
            <JoinForm queueId={queue.id} businessId={queue.businessId} />
          </div>
        </>
      )}
    </div>
  );
}
