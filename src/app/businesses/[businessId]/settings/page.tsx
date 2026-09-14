import { AuthError, getCurrentUser } from "@/lib/auth";
import { getAuthorizedBusinessForUser } from "@/lib/tenant";
import { getBusinessSettings } from "@/lib/actions/settings";
import { AppHeader } from "@/components/dashboard/app-header";
import { SettingsView } from "@/components/settings/settings-view";
import { redirect, notFound } from "next/navigation";

export default async function BusinessSettingsPage({
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
    ({ business, workspace } = await getAuthorizedBusinessForUser(
      user,
      businessId,
      "MANAGER"
    ));
  } catch (err) {
    if (err instanceof AuthError && err.code === "UNAUTHENTICATED") {
      redirect("/sign-in");
    }
    notFound();
  }

  const settingsData = await getBusinessSettings(business.id);

  if ("error" in settingsData || !settingsData.snapshot) {
    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader title={workspace.name} subtitle="Settings" />
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <p
            className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm"
            role="alert"
          >
            {"error" in settingsData ? settingsData.error : "Settings could not be loaded."}
          </p>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <AppHeader title={workspace.name} subtitle="Business Settings" />
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <SettingsView initial={settingsData.snapshot} />
      </main>
    </div>
  );
}
