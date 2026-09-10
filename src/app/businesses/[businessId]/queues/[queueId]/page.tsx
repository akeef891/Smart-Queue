import { AuthError, getCurrentUser } from "@/lib/auth";
import { getAuthorizedQueueForUser } from "@/lib/tenant";
import { AppHeader } from "@/components/dashboard/app-header";
import { QueueManagePanel } from "@/components/dashboard/queue-manage-panel";
import { QueueLivePanel } from "@/components/dashboard/queue-live-panel";
import { QueueJoinQr } from "@/components/dashboard/queue-join-qr";
import { prisma } from "@/lib/prisma";
import { formatTicketNumber } from "@/lib/ticket";
import { getAppOrigin } from "@/lib/app-origin";
import { getQueueHistory } from "@/lib/actions/ticket";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

function formatDateTime(value: Date) {
  return value.toLocaleString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function QueueDetailPage({
  params,
}: {
  params: Promise<{ businessId: string; queueId: string }>;
}) {
  try {
    const user = await getCurrentUser();
    const { businessId, queueId } = await params;

    let queue;
    let business;
    let workspace;
    try {
      ({ queue, business, workspace } = await getAuthorizedQueueForUser(
        user,
        queueId,
        businessId
      ));
    } catch (err) {
      if (err instanceof AuthError && err.code === "UNAUTHENTICATED") {
        throw err;
      }
      notFound();
    }

    const [serving, called, waiting, recentlyCompleted] = await Promise.all([
      prisma.queueEntry.findFirst({
        where: { queueId: queue.id, status: "SERVING" },
        orderBy: { tokenNumber: "asc" },
      }),
      prisma.queueEntry.findFirst({
        where: { queueId: queue.id, status: "CALLED" },
        orderBy: { tokenNumber: "asc" },
      }),
      prisma.queueEntry.findMany({
        where: { queueId: queue.id, status: "WAITING" },
        orderBy: { tokenNumber: "asc" },
      }),
      prisma.queueEntry.findMany({
        where: { queueId: queue.id, status: "COMPLETED" },
        orderBy: { completedAt: "desc" },
        take: 5,
      }),
    ]);

    const toRow = (entry: {
      id: string;
      customerName: string;
      tokenNumber: number;
      status: string;
      joinedAt: Date;
    }) => ({
      id: entry.id,
      customerName: entry.customerName,
      tokenLabel: formatTicketNumber(queue.slug, entry.tokenNumber),
      status: entry.status,
      joinedAt: entry.joinedAt.toISOString(),
    });

    const joinPath = `/businesses/${business.id}/queues/${queue.id}/join`;
    const origin = await getAppOrigin();
    const joinUrl = origin ? `${origin}${joinPath}` : joinPath;
    const historyResult = await getQueueHistory(business.id, queue.id);
    const initialHistory = "history" in historyResult ? historyResult.history : [];
    const initialHistoryError =
      "error" in historyResult && historyResult.error ? historyResult.error : null;

    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader title={workspace.name} subtitle="Queue" />

        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={`/businesses/${business.id}`}
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              ← Back to {business.name}
            </Link>
            <Link
              href={`/businesses/${business.id}/queues/${queue.id}/analytics`}
              className="rounded-md border px-3 py-1.5 text-sm font-medium hover:bg-white"
            >
              Analytics
            </Link>
          </div>

          <section className="mt-4 rounded-xl border bg-white p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">Queue Overview</p>
                <h2 className="mt-1 text-2xl font-semibold">{queue.name}</h2>
                {queue.description ? (
                  <p className="mt-2 text-sm text-slate-600">{queue.description}</p>
                ) : (
                  <p className="mt-2 text-sm text-slate-400">No description yet.</p>
                )}
              </div>
              <span className="rounded-full border px-3 py-1 text-xs font-medium tracking-wide">
                {queue.status}
              </span>
            </div>

            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Business</dt>
                <dd className="mt-0.5 font-medium">{business.name}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd className="mt-0.5 font-medium">{queue.status}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Created</dt>
                <dd className="mt-0.5 font-medium">{formatDateTime(queue.createdAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Updated</dt>
                <dd className="mt-0.5 font-medium">{formatDateTime(queue.updatedAt)}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Avg. service time</dt>
                <dd className="mt-0.5 font-medium">{queue.averageServiceTime} min</dd>
              </div>
              <div>
                <dt className="text-slate-500">Capacity</dt>
                <dd className="mt-0.5 font-medium">
                  {queue.maxCapacity == null ? "Unlimited" : queue.maxCapacity}
                </dd>
              </div>
            </dl>
          </section>

          <p className="mt-4 text-sm text-slate-500">
            Customer join link:{" "}
            <Link href={joinPath} className="font-medium text-slate-900 underline hover:no-underline">
              Join this queue
            </Link>
          </p>

          <QueueJoinQr joinUrl={joinUrl} />

          <QueueLivePanel
            businessId={business.id}
            queueId={queue.id}
            initial={{
              currentlyServing: serving ? toRow(serving) : null,
              currentlyCalled: called ? toRow(called) : null,
              waiting: waiting.map(toRow),
              recentlyCompleted: recentlyCompleted.map(toRow),
              totalServed: queue.totalServed,
            }}
            initialHistory={initialHistory}
            initialHistoryError={initialHistoryError}
          />

          <QueueManagePanel
            businessId={business.id}
            queueId={queue.id}
            name={queue.name}
            description={queue.description}
            status={queue.status}
          />
        </main>
      </div>
    );
  } catch (err) {
    if (err instanceof AuthError && err.code === "UNAUTHENTICATED") {
      redirect("/sign-in");
    }
    throw err;
  }
}
