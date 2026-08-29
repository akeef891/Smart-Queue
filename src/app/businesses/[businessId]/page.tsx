import { AuthError, getCurrentUser } from "@/lib/auth";
import { getAuthorizedBusinessForUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/dashboard/app-header";
import { CreateQueueDialog } from "@/components/dashboard/create-queue-form";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
}) {
  try {
    const user = await getCurrentUser();
    const { businessId } = await params;

    let business;
    let workspace;
    try {
      ({ business, workspace } = await getAuthorizedBusinessForUser(user, businessId));
    } catch (err) {
      if (err instanceof AuthError && err.code === "UNAUTHENTICATED") {
        throw err;
      }
      notFound();
    }

    const queues = await prisma.queue.findMany({
      where: { businessId: business.id, workspaceId: workspace.id },
      orderBy: { createdAt: "desc" },
    });

    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader title={workspace.name} subtitle="Business" />

        <main className="mx-auto max-w-3xl px-6 py-8">
          <Link href="/businesses" className="text-sm text-slate-500 hover:text-slate-900">
            ← Back to businesses
          </Link>

          <section className="mt-4 rounded-xl border bg-white p-6">
            <h2 className="text-2xl font-semibold">{business.name}</h2>
            {business.description ? (
              <p className="mt-2 text-sm text-slate-600">{business.description}</p>
            ) : (
              <p className="mt-2 text-sm text-slate-400">No description yet.</p>
            )}
            <dl className="mt-6 grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-slate-500">Status</dt>
                <dd className="mt-0.5 font-medium">{business.status}</dd>
              </div>
              <div>
                <dt className="text-slate-500">Created</dt>
                <dd className="mt-0.5 font-medium">
                  {business.createdAt.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "short",
                    day: "numeric",
                  })}
                </dd>
              </div>
            </dl>
          </section>

          <section className="mt-6 rounded-xl border bg-white p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <h3 className="text-base font-semibold">Queues</h3>
              <CreateQueueDialog businessId={business.id} />
            </div>

            {queues.length === 0 ? (
              <div className="mt-8 text-center">
                <p className="font-medium">No queues yet</p>
                <p className="mt-1 text-sm text-slate-500">
                  Create your first queue for this business.
                </p>
                <div className="mt-4 flex justify-center">
                  <CreateQueueDialog businessId={business.id} label="Create Queue" />
                </div>
              </div>
            ) : (
              <ul className="mt-5 divide-y rounded-lg border">
                {queues.map((queue) => (
                  <li key={queue.id} className="flex items-start justify-between gap-3 px-4 py-4">
                    <div>
                      <p className="font-medium">{queue.name}</p>
                      <p className="mt-0.5 text-xs font-medium tracking-wide text-slate-500">
                        {queue.status}
                      </p>
                      {queue.description ? (
                        <p className="mt-1 text-sm text-slate-600">{queue.description}</p>
                      ) : null}
                    </div>
                    <Link
                      href={`/businesses/${business.id}/queues/${queue.id}`}
                      className="shrink-0 rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
                    >
                      View
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </section>
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
