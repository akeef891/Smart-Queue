"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import {
  getBusinessDashboard,
  type BusinessDashboardSnapshot,
  type BusinessQueueSummary,
} from "@/lib/actions/business-dashboard";
import { CreateQueueDialog } from "@/components/dashboard/create-queue-form";
import { LiveStatus } from "@/components/live-status";
import { useBusinessQueuesRealtime } from "@/hooks/use-business-queues-realtime";

function BusinessMetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-2 text-2xl font-semibold">{value}</p>
    </div>
  );
}

function BusinessQueueCard({
  businessId,
  queue,
  userRole,
}: {
  businessId: string;
  queue: BusinessQueueSummary;
  userRole: BusinessDashboardSnapshot["userRole"];
}) {
  const operationsHref = `/businesses/${businessId}/queues/${queue.id}`;
  return (
    <article className="rounded-xl border bg-white p-5">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h4 className="text-base font-semibold">{queue.name}</h4>
        <span className="rounded-full border px-3 py-1 text-xs font-medium tracking-wide">
          {queue.status}
        </span>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-slate-500">Waiting</dt>
          <dd className="mt-0.5 font-medium">{queue.waiting}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Called</dt>
          <dd className="mt-0.5 font-medium">{queue.called}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Serving</dt>
          <dd className="mt-0.5 font-medium">{queue.serving}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Served today</dt>
          <dd className="mt-0.5 font-medium">{queue.servedToday}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Capacity</dt>
          <dd className="mt-0.5 font-medium">{queue.maxCapacity == null ? "Unlimited" : queue.maxCapacity}</dd>
        </div>
        <div>
          <dt className="text-slate-500">Avg. service</dt>
          <dd className="mt-0.5 font-medium">{queue.averageServiceTime} min</dd>
        </div>
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Link
          href={operationsHref}
          className="rounded-md bg-slate-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-slate-800"
        >
          Open Queue
        </Link>
        {userRole !== "STAFF" ? (
          <Link
            href={`${operationsHref}/analytics`}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
          >
            Analytics
          </Link>
        ) : null}
        <Link
          href={`${operationsHref}/join`}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
        >
          Join the queue
        </Link>
      </div>
    </article>
  );
}

function BusinessQuickActions({
  businessId,
  queues,
  userRole,
}: {
  businessId: string;
  queues: BusinessQueueSummary[];
  userRole: BusinessDashboardSnapshot["userRole"];
}) {
  return (
    <section className="rounded-xl border bg-white p-6">
      <h3 className="text-base font-semibold">Quick actions</h3>
      <div className="mt-4 flex flex-wrap gap-2">
        {userRole === "OWNER" ? (
          <CreateQueueDialog businessId={businessId} label="Create Queue" />
        ) : null}
        {userRole !== "STAFF" ? (
          <Link
            href={`/businesses/${businessId}/insights`}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Business Insights
          </Link>
        ) : null}
        {userRole === "OWNER" ? (
          <Link
            href={`/businesses/${businessId}/staff`}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            Team & Staff
          </Link>
        ) : null}
        <a
          href="#queues"
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          {userRole === "STAFF" ? "Assigned Queues" : "Manage Queues"}
        </a>
        {userRole !== "STAFF" && queues.length === 1 ? (
          <Link
            href={`/businesses/${businessId}/queues/${queues[0].id}/analytics`}
            className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-slate-50"
          >
            View Analytics
          </Link>
        ) : null}
      </div>
    </section>
  );
}

export function BusinessDashboard({
  businessId,
  initial,
}: {
  businessId: string;
  initial: BusinessDashboardSnapshot;
}) {
  const [snapshot, setSnapshot] = useState(initial);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    void getBusinessDashboard(businessId).then((result) => {
      if ("error" in result && result.error) {
        setError(result.error);
        return;
      }
      if ("snapshot" in result && result.snapshot) {
        setError(null);
        setSnapshot(result.snapshot);
      }
    });
  }, [businessId]);

  const liveStatus = useBusinessQueuesRealtime(
    snapshot.queues.map((queue) => queue.id),
    refresh
  );

  return (
    <div className="space-y-6">
      <section className="rounded-xl border bg-white p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">
              {snapshot.greeting}, {snapshot.businessName}
            </p>
            <h2 className="mt-1 text-2xl font-semibold">{snapshot.businessName}</h2>
            <p className="mt-2 text-sm text-slate-600">
              {snapshot.userRole === "STAFF"
                ? "Assigned live queues operational dashboard."
                : "Here's what's happening across your queues."}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <span
              className={`rounded-full border px-3 py-1 text-xs font-semibold tracking-wide ${
                snapshot.userRole === "OWNER"
                  ? "border-purple-200 bg-purple-50 text-purple-700"
                  : snapshot.userRole === "MANAGER"
                  ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                  : "border-blue-200 bg-blue-50 text-blue-700"
              }`}
            >
              {snapshot.userRole}
            </span>
            <span className="rounded-full border px-3 py-1 text-xs font-medium tracking-wide">
              {snapshot.businessStatus}
            </span>
            <LiveStatus status={liveStatus} />
            {snapshot.userRole === "OWNER" ? (
              <Link
                href={`/businesses/${businessId}/staff`}
                className="rounded-md border bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Team & Staff
              </Link>
            ) : null}
            {snapshot.userRole !== "STAFF" ? (
              <Link
                href={`/businesses/${businessId}/insights`}
                className="rounded-md border bg-white px-3 py-1.5 text-sm font-medium text-slate-700 shadow-sm hover:bg-slate-50"
              >
                Insights
              </Link>
            ) : null}
            {snapshot.userRole === "OWNER" ? (
              <CreateQueueDialog businessId={businessId} label="Create Queue" />
            ) : null}
          </div>
        </div>
      </section>

      {error ? (
        <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
          {error}
        </p>
      ) : null}

      <section>
        <h3 className="text-base font-semibold">Business overview</h3>
        <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
          <BusinessMetricCard label="Active Queues" value={snapshot.activeQueues} />
          <BusinessMetricCard label="Waiting Customers" value={snapshot.waiting} />
          <BusinessMetricCard label="Currently Serving" value={snapshot.serving} />
          <BusinessMetricCard label="Called Customers" value={snapshot.called} />
          <BusinessMetricCard label="Served Today" value={snapshot.servedToday} />
          <BusinessMetricCard label="Cancelled Today" value={snapshot.cancelledToday} />
        </div>
      </section>

      <BusinessQuickActions businessId={businessId} queues={snapshot.queues} userRole={snapshot.userRole} />

      <section id="queues">
        <h3 className="text-base font-semibold">
          {snapshot.userRole === "STAFF" ? "Your Assigned Queues" : "Your Queues"}
        </h3>
        {snapshot.queues.length === 0 ? (
          <div className="mt-3 rounded-xl border bg-white p-8 text-center">
            {snapshot.userRole === "OWNER" ? (
              <>
                <p className="font-medium">No queues yet</p>
                <p className="mt-1 text-sm text-slate-500">
                  Create your first queue to start managing customer waiting lines.
                </p>
                <div className="mt-4 flex justify-center">
                  <CreateQueueDialog businessId={businessId} label="Create Queue" />
                </div>
              </>
            ) : snapshot.userRole === "MANAGER" ? (
              <>
                <p className="font-medium">No queues yet</p>
                <p className="mt-1 text-sm text-slate-500">
                  No queues have been created for this business yet. Please contact the business owner to create queues.
                </p>
              </>
            ) : (
              <>
                <p className="font-medium">No assigned queues</p>
                <p className="mt-1 text-sm text-slate-500">
                  You do not have any queues assigned to your account. Contact your manager or business owner to assign queues to you.
                </p>
              </>
            )}
          </div>
        ) : (
          <div className="mt-3 grid grid-cols-1 gap-4 lg:grid-cols-2">
            {snapshot.queues.map((queue) => (
              <BusinessQueueCard
                key={queue.id}
                businessId={businessId}
                queue={queue}
                userRole={snapshot.userRole}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
