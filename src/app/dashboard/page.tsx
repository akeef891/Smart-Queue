import { AuthError, getCurrentUser } from "@/lib/auth";
import { getCurrentWorkspace } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { CreateWorkspaceForm } from "@/components/dashboard/create-workspace-form";
import { UserMenu } from "@/components/dashboard/user-menu";
import { AppHeader } from "@/components/dashboard/app-header";
import { redirect } from "next/navigation";
import Link from "next/link";

function DashboardHeader({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="flex items-center justify-between border-b bg-white px-6 py-4">
      <div>
        <h1 className="text-lg font-semibold">{title}</h1>
        {subtitle ? <p className="text-sm text-slate-500">{subtitle}</p> : null}
      </div>
      <UserMenu />
    </header>
  );
}

export default async function DashboardPage() {
  try {
    const user = await getCurrentUser();
    const workspace = await getCurrentWorkspace(user);

    if (!workspace) {
      return (
        <div className="min-h-screen bg-slate-50">
          <DashboardHeader title="Smart Queue" subtitle="Get started" />
          <main className="flex min-h-[calc(100vh-73px)] items-center justify-center px-6 py-12">
            <div className="w-full max-w-md rounded-xl border bg-white p-8 text-center shadow-sm">
              <h2 className="text-xl font-semibold">Create your first workspace</h2>
              <p className="mt-2 text-sm text-slate-500">
                A workspace is your organization. Everything — businesses, queues, and customers —
                lives inside it.
              </p>
              <CreateWorkspaceForm />
            </div>
          </main>
        </div>
      );
    }

    const [businessCount, activeQueueCount, waitingCount, servedCount, recentEntries] =
      await Promise.all([
        prisma.business.count({ where: { workspaceId: workspace.id } }),
        prisma.queue.count({
          where: { workspaceId: workspace.id, status: "ACTIVE" },
        }),
        prisma.queueEntry.count({
          where: { workspaceId: workspace.id, status: "WAITING" },
        }),
        prisma.queueEntry.count({
          where: { workspaceId: workspace.id, status: "COMPLETED" },
        }),
        prisma.queueEntry.findMany({
          where: { workspaceId: workspace.id },
          orderBy: { updatedAt: "desc" },
          take: 8,
          include: { queue: { select: { name: true } } },
        }),
      ]);

    const stats = [
      { label: "Total Businesses", value: businessCount },
      { label: "Active Queues", value: activeQueueCount },
      { label: "Customers Waiting", value: waitingCount },
      { label: "Customers Served", value: servedCount },
    ];

    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader title={workspace.name} subtitle="Dashboard" />

        <main className="mx-auto max-w-6xl px-6 py-8">
          <section className="flex flex-col gap-4 rounded-xl border bg-white p-6 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold">
                Welcome{user.displayName ? `, ${user.displayName}` : ""}
              </p>
              <p className="mt-1 text-sm text-slate-500">
                You are signed in as {user.email}. Queue, business, and customer tools will appear
                here as you add them.
              </p>
            </div>
            <Link
              href="/businesses"
              className="shrink-0 rounded-md bg-slate-900 px-4 py-2 text-center text-sm font-medium text-white"
            >
              Manage Businesses
            </Link>
          </section>

          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {stats.map((s) => {
              const card = (
                <div className="rounded-lg border bg-white p-5">
                  <p className="text-sm text-slate-500">{s.label}</p>
                  <p className="mt-2 text-3xl font-semibold">{s.value}</p>
                </div>
              );

              if (s.label === "Total Businesses") {
                return (
                  <Link key={s.label} href="/businesses" className="block hover:border-slate-300">
                    {card}
                  </Link>
                );
              }

              return <div key={s.label}>{card}</div>;
            })}
          </div>

          <section className="mt-8">
            <h2 className="mb-3 text-base font-semibold">Recent Queue Activity</h2>
            {recentEntries.length === 0 ? (
              <p className="rounded-lg border bg-white p-6 text-sm text-slate-500">
                No activity yet. Once customers start joining your queues, updates will appear here.
              </p>
            ) : (
              <ul className="divide-y rounded-lg border bg-white">
                {recentEntries.map((e) => (
                  <li key={e.id} className="flex items-center justify-between px-5 py-3 text-sm">
                    <span>
                      #{e.tokenNumber} · {e.customerName} — {e.queue.name}
                    </span>
                    <span className="text-slate-500">{e.status}</span>
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

    return (
      <div className="min-h-screen bg-slate-50">
        <DashboardHeader title="Smart Queue" />
        <main className="flex min-h-[calc(100vh-73px)] items-center justify-center px-6">
          <p className="max-w-md text-center text-sm text-slate-600">
            We couldn&apos;t load your dashboard right now. Please refresh the page and try again.
          </p>
        </main>
      </div>
    );
  }
}
