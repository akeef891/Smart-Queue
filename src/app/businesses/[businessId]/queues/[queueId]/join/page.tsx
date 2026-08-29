import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { queueAcceptsJoins } from "@/lib/queue-state";
import { CustomerJoinForm } from "@/components/customer/customer-join-form";

export default async function PublicJoinPage({
  params,
}: {
  params: Promise<{ businessId: string; queueId: string }>;
}) {
  const { businessId, queueId } = await params;

  const queue = await prisma.queue.findFirst({
    where: { id: queueId, businessId },
    select: {
      id: true,
      name: true,
      status: true,
      business: { select: { id: true, name: true, status: true } },
    },
  });

  if (!queue || queue.business.status === "ARCHIVED") {
    notFound();
  }

  const canJoin = queueAcceptsJoins(queue.status);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <p className="text-sm font-medium uppercase tracking-wide text-slate-400">Join Queue</p>
      <p className="mt-4 text-sm text-slate-500">Business</p>
      <p className="font-medium">{queue.business.name}</p>
      <p className="mt-3 text-sm text-slate-500">Queue</p>
      <h1 className="text-2xl font-semibold">{queue.name}</h1>

      {!canJoin ? (
        <p className="mt-6 rounded-lg border bg-amber-50 p-4 text-sm text-amber-800">
          This queue isn&apos;t accepting customers right now. Please check back later.
        </p>
      ) : (
        <CustomerJoinForm businessId={queue.business.id} queueId={queue.id} />
      )}
    </div>
  );
}
