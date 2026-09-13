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
      business: {
        select: {
          id: true,
          name: true,
          logoUrl: true,
          status: true,
          settings: {
            select: {
              welcomeMessage: true,
              queueInstructions: true,
            },
          },
        },
      },
    },
  });

  if (!queue || queue.business.status === "ARCHIVED") {
    notFound();
  }

  const canJoin = queueAcceptsJoins(queue.status);
  const welcome = queue.business.settings?.welcomeMessage;
  const instructions = queue.business.settings?.queueInstructions;

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10">
      <div className="flex items-center gap-3">
        {queue.business.logoUrl ? (
          <div className="relative flex h-14 w-14 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 bg-white p-1 shadow-sm">
            <img
              src={queue.business.logoUrl}
              alt={`${queue.business.name} logo`}
              className="max-h-full max-w-full object-contain"
            />
          </div>
        ) : null}
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Join Queue</p>
          <p className="text-base font-bold text-slate-900">{queue.business.name}</p>
        </div>
      </div>

      <p className="mt-4 text-xs font-medium uppercase tracking-wider text-slate-400">Queue</p>
      <h1 className="text-2xl font-bold text-slate-900">{queue.name}</h1>

      {welcome ? (
        <p className="mt-3 text-sm text-slate-600 bg-slate-100 rounded-lg p-3">
          {welcome}
        </p>
      ) : null}

      {!canJoin ? (
        <p className="mt-6 rounded-lg border bg-amber-50 p-4 text-sm text-amber-800">
          This queue isn&apos;t accepting customers right now. Please check back later.
        </p>
      ) : (
        <>
          <CustomerJoinForm businessId={queue.business.id} queueId={queue.id} />
          {instructions ? (
            <p className="mt-4 text-xs text-slate-500 text-center">
              {instructions}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
}
