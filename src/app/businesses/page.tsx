import { AuthError, getCurrentUser } from "@/lib/auth";
import { getCurrentWorkspace, listAccessibleBusinessesForUser } from "@/lib/tenant";
import { prisma } from "@/lib/prisma";
import { AppHeader } from "@/components/dashboard/app-header";
import { CreateBusinessDialog } from "@/components/dashboard/create-business-form";
import { redirect } from "next/navigation";
import Link from "next/link";

function formatDate(value: Date) {
  return value.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export default async function BusinessesPage() {
  let user;
  try {
    user = await getCurrentUser();
  } catch (err) {
    if (err instanceof AuthError && err.code === "UNAUTHENTICATED") {
      redirect("/sign-in");
    }
    throw err;
  }

  let workspace;
  let businesses;
  try {
    workspace = await getCurrentWorkspace(user);
    businesses = await listAccessibleBusinessesForUser(user);
  } catch {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader title="Smart Queue" />
        <main className="flex min-h-[calc(100vh-73px)] items-center justify-center px-6">
          <p className="max-w-md text-center text-sm text-slate-600">
            We couldn&apos;t load your businesses right now. Please refresh the page and try again.
          </p>
        </main>
      </div>
    );
  }

  if (!workspace && businesses.length === 0) {
    redirect("/dashboard");
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader title={workspace?.name ?? "Smart Queue"} subtitle="Businesses" />

        <main className="mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h2 className="text-2xl font-semibold">Businesses</h2>
              <p className="mt-1 max-w-xl text-sm text-slate-500">
                Locations and brands you have access to. Manage your queues and team members.
              </p>
            </div>
            {workspace ? <CreateBusinessDialog /> : null}
          </div>

          {businesses.length === 0 ? (
            <div className="mt-10 rounded-xl border bg-white px-6 py-16 text-center">
              <p className="text-base font-medium">No businesses yet.</p>
              <p className="mt-1 text-sm text-slate-500">
                Create your first business to start managing queues.
              </p>
              {workspace ? (
                <div className="mt-6 flex justify-center">
                  <CreateBusinessDialog label="Create Business" />
                </div>
              ) : null}
            </div>
          ) : (
            <ul className="mt-8 grid gap-4 sm:grid-cols-2">
              {businesses.map((business) => (
                <li key={business.id} className="rounded-xl border bg-white p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold">{business.name}</h3>
                        <span
                          className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                            business.role === "OWNER"
                              ? "border-purple-200 bg-purple-50 text-purple-700"
                              : business.role === "MANAGER"
                              ? "border-indigo-200 bg-indigo-50 text-indigo-700"
                              : "border-blue-200 bg-blue-50 text-blue-700"
                          }`}
                        >
                          {business.role}
                        </span>
                      </div>
                      {business.description ? (
                        <p className="mt-1 text-sm text-slate-600">{business.description}</p>
                      ) : (
                        <p className="mt-1 text-sm text-slate-400">No description</p>
                      )}
                    </div>
                    <Link
                      href={`/businesses/${business.id}`}
                      className="shrink-0 rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50"
                    >
                      View
                    </Link>
                  </div>
                  <p className="mt-4 text-xs text-slate-500">
                    Added {formatDate(business.createdAt)}
                    {business._count.queues > 0
                      ? ` · ${business._count.queues} queue${business._count.queues === 1 ? "" : "s"}`
                      : ""}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </main>
      </div>
    );
}
