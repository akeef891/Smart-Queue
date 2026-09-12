import { AuthError, getCurrentUser } from "@/lib/auth";
import { getAuthorizedBusinessForUser } from "@/lib/tenant";
import { getBusinessInsights } from "@/lib/actions/insights";
import { AppHeader } from "@/components/dashboard/app-header";
import { BusinessInsightsView } from "@/components/dashboard/business-insights-view";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

export default async function BusinessInsightsPage({
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

    const result = await getBusinessInsights(business.id);

    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader title={workspace.name} subtitle="Business Insights" />

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Link
              href={`/businesses/${business.id}`}
              className="text-sm text-slate-500 hover:text-slate-900"
            >
              ← Back to {business.name}
            </Link>
          </div>

          <div className="mt-4 mb-6">
            <div className="flex flex-wrap items-baseline gap-2">
              <h1 className="text-2xl font-bold tracking-tight text-slate-900">
                Business Insights
              </h1>
              <span className="text-sm text-slate-500">· {business.name}</span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              Real-time operational health, waiting trends, throughput, and completion metrics.
            </p>
          </div>

          {"error" in result && result.error ? (
            <p
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm"
              role="alert"
            >
              {result.error}
            </p>
          ) : "snapshot" in result && result.snapshot ? (
            <BusinessInsightsView businessId={business.id} initial={result.snapshot} />
          ) : (
            <p className="rounded-xl border bg-white p-6 text-sm text-slate-500 shadow-sm">
              Insights could not be loaded. Please try again.
            </p>
          )}
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
