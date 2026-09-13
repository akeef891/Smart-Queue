import { AuthError, getCurrentUser } from "@/lib/auth";
import { getAuthorizedBusinessForUser } from "@/lib/tenant";
import { getBusinessStaff } from "@/lib/actions/staff";
import { AppHeader } from "@/components/dashboard/app-header";
import { StaffManagementView } from "@/components/dashboard/staff-management-view";
import { redirect, notFound } from "next/navigation";

export default async function BusinessStaffPage({
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
      ({ business, workspace } = await getAuthorizedBusinessForUser(user, businessId, "OWNER"));
    } catch (err) {
      if (err instanceof AuthError && err.code === "UNAUTHENTICATED") {
        throw err;
      }
      notFound();
    }

    const staffData = await getBusinessStaff(business.id);

    if (staffData.error || !staffData.members || !staffData.allQueues) {
      return (
        <div className="min-h-screen bg-slate-50">
          <AppHeader title={workspace.name} subtitle="Team Access" />
          <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
            <p
              className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 shadow-sm"
              role="alert"
            >
              {staffData.error || "Staff details could not be loaded."}
            </p>
          </main>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-slate-50">
        <AppHeader title={workspace.name} subtitle="Team Access" />

        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <StaffManagementView
            businessId={business.id}
            businessName={business.name}
            initialMembers={staffData.members}
            allQueues={staffData.allQueues}
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
