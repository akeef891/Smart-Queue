import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { formatTicketNumber } from "@/lib/ticket";
import { getTicketPosition } from "@/lib/actions/ticket";

export default async function TrackPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;

  const entry = await prisma.queueEntry.findUnique({
    where: { trackingToken: token },
    include: { queue: { include: { business: { select: { name: true } } } } },
  });

  if (!entry) notFound();

  const { peopleAhead, position } = await getTicketPosition(entry);
  const label = formatTicketNumber(entry.queue.slug, entry.tokenNumber);

  return (
    <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-6 px-6 text-center">
      <div>
        <p className="text-sm text-slate-500">{entry.queue.business.name}</p>
        <p className="text-sm text-slate-500">{entry.queue.name}</p>
      </div>

      <div>
        <p className="text-xs uppercase tracking-wide text-slate-400">Ticket</p>
        <p className="text-6xl font-bold">{label}</p>
      </div>

      <StatusBadge status={entry.status} />

      {entry.status === "WAITING" && (
        <div className="flex gap-8 text-sm">
          <div>
            <p className="text-slate-500">People ahead</p>
            <p className="text-lg font-semibold">{peopleAhead}</p>
          </div>
          <div>
            <p className="text-slate-500">Position</p>
            <p className="text-lg font-semibold">{position}</p>
          </div>
        </div>
      )}

      {entry.status === "CALLED" && (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm font-medium text-amber-800">
          You&apos;re being called — please proceed to the counter.
        </p>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const labels: Record<string, string> = {
    WAITING: "Waiting",
    CALLED: "You're being called",
    SERVING: "Now being served",
    COMPLETED: "Completed",
    SKIPPED: "Skipped",
    CANCELLED: "Cancelled",
    NO_SHOW: "Marked as no-show",
  };
  return (
    <span className="rounded-full bg-slate-100 px-4 py-1 text-sm font-medium">
      {labels[status] ?? status}
    </span>
  );
}
