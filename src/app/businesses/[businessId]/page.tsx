import { AuthError, getCurrentUser } from "@/lib/auth";
import { getAuthorizedBusinessForUser } from "@/lib/tenant";
import { getBusinessDashboard } from "@/lib/actions/business-dashboard";
import { AppHeader } from "@/components/dashboard/app-header";
import { BusinessDashboard } from "@/components/dashboard/business-dashboard";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";

export default async function BusinessDetailPage({
  params,
}: {
  params: Promise<{ businessId: string }>;
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

  const { businessId } = await params;

  let business;
  let workspace;
  try {
    ({ business, workspace } = await getAuthorizedBusinessForUser(user, businessId));
  } catch (err) {
    if (err instanceof AuthError && err.code === "UNAUTHENTICATED") {
      redirect("/sign-in");
    }
    notFound();
  }

  const dashboard = await getBusinessDashboard(business.id);

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader title={workspace.name} subtitle="Business" />

      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Link href="/businesses" className="text-sm text-slate-500 hover:text-slate-900">
          ← Back to businesses
        </Link>

        <div className="mt-4">
          {"error" in dashboard && dashboard.error ? (
            <p className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700" role="alert">
              {dashboard.error}
            </p>
          ) : "snapshot" in dashboard && dashboard.snapshot ? (
            <BusinessDashboard businessId={business.id} initial={dashboard.snapshot} />
          ) : (
            <p className="rounded-xl border bg-white p-6 text-sm text-slate-500">
              This dashboard could not be loaded. Please try again.
            </p>
          )}
        </div>
      </main>
    </div>
  );
}
