import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatTicketNumber } from "@/lib/ticket";
import { getTicketPosition } from "@/lib/actions/ticket";

export default async function CustomerTicketPage({
  params,
}: {
  params: Promise<{ businessId: string; queueId: string; ticketId: string }>;
}) {
  const { businessId, queueId, ticketId } = await params;

  const entry = await prisma.queueEntry.findFirst({
    where: {
      trackingToken: ticketId,
      queueId,
      queue: { businessId },
    },
    include: {
      queue: {
        select: {
          name: true,
          slug: true,
          business: { select: { name: true } },
        },
      },
    },
  });

  if (!entry) {
    notFound();
  }

  const { peopleAhead, position } = await getTicketPosition(entry);
  const label = formatTicketNumber(entry.queue.slug, entry.tokenNumber);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-10 text-center">
      <p className="text-sm font-medium uppercase tracking-wide text-slate-400">Your Queue Ticket</p>
      <p className="mt-4 text-sm text-slate-500">{entry.queue.business.name}</p>
      <p className="text-base font-medium">{entry.queue.name}</p>

      <p className="mt-8 text-xs uppercase tracking-wide text-slate-400">Ticket</p>
      <p className="text-5xl font-bold tracking-tight">{label}</p>

      <p className="mt-6 text-xs uppercase tracking-wide text-slate-400">Status</p>
      <p className="mt-1 text-lg font-semibold">{entry.status}</p>

      {entry.status === "WAITING" ? (
        <div className="mt-8 grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-lg border bg-white p-4">
            <p className="text-slate-500">People Ahead</p>
            <p className="mt-1 text-2xl font-semibold">{peopleAhead}</p>
          </div>
          <div className="rounded-lg border bg-white p-4">
            <p className="text-slate-500">Position</p>
            <p className="mt-1 text-2xl font-semibold">{position}</p>
          </div>
        </div>
      ) : null}

      {entry.status === "CALLED" ? (
        <p className="mt-8 rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          You&apos;re being called — please proceed to the counter.
        </p>
      ) : null}

      {entry.status === "SERVING" ? (
        <p className="mt-8 rounded-lg bg-slate-100 px-4 py-3 text-sm font-medium text-slate-700">
          You are now being served.
        </p>
      ) : null}

      {entry.status === "COMPLETED" ? (
        <p className="mt-8 text-sm text-slate-500">This ticket has been completed.</p>
      ) : null}

      {entry.status === "CANCELLED" ? (
        <p className="mt-8 text-sm text-slate-500">This ticket was cancelled.</p>
      ) : null}

      <p className="mt-10 text-xs text-slate-400">Refresh this page to see the latest status.</p>
    </div>
  );
}
