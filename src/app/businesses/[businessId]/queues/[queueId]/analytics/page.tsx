import { AuthError, getCurrentUser } from "@/lib/auth";
import { getAuthorizedQueueForUser } from "@/lib/tenant";
import { getQueueAnalytics } from "@/lib/actions/analytics";
import { AppHeader } from "@/components/dashboard/app-header";
import { QueueAnalyticsView } from "@/components/dashboard/queue-analytics-view";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

export default async function QueueAnalyticsPage({
  params,
}: {
  params: Promise<{ businessId: string; queueId: string }>;
}) {
  let user;
  try {
    user = await getCurrentUser();
  } catch (err) {
    if (err instanceof AuthError && err.code === "UNAUTHENTICATED") {
      redirect("/sign-in");
    }
    throw err;
  }

  const { businessId, queueId } = await params;

  let queue;
  let business;
  let workspace;
  let role;
  try {
    ({ queue, business, workspace, role } = await getAuthorizedQueueForUser(
      user,
      queueId,
      businessId
    ));
  } catch (err) {
    if (err instanceof AuthError && err.code === "UNAUTHENTICATED") {
      redirect("/sign-in");
    }
    notFound();
  }

  if (role === "STAFF") {
    notFound();
  }

  const analytics = await getQueueAnalytics(business.id, queue.id);
  const snapshot =
    "snapshot" in analytics && analytics.snapshot
      ? analytics.snapshot
      : {
          queueName: queue.name,
          rangeLabel: "Today",
          totalCustomers: 0,
          completed: 0,
          cancelled: 0,
          waiting: 0,
          called: 0,
          serving: 0,
          skipped: 0,
          noShow: 0,
          avgWaitMs: null,
          avgServiceMs: null,
          completionRate: null,
        };

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader title={workspace.name} subtitle="Analytics" />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            href={`/businesses/${business.id}/queues/${queue.id}`}
            className="text-sm text-slate-500 hover:text-slate-900"
          >
            ← Back to queue
          </Link>
        </div>
        <h1 className="mt-4 text-2xl font-semibold">Queue Analytics</h1>
        <p className="mt-1 text-slate-600">{queue.name}</p>
        {"error" in analytics && analytics.error ? (
          <p className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
            {analytics.error}
          </p>
        ) : (
          <QueueAnalyticsView businessId={business.id} queueId={queue.id} initial={snapshot} />
        )}
      </main>
    </div>
  );
}
