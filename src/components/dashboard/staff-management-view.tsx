"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  type StaffMemberRecord,
  addStaffMember,
  updateStaffMember,
  removeStaffMember,
} from "@/lib/actions/staff";
import type { BusinessRole } from "@/lib/tenant";

interface StaffManagementViewProps {
  businessId: string;
  businessName: string;
  initialMembers: StaffMemberRecord[];
  allQueues: { id: string; name: string }[];
}

export function StaffManagementView({
  businessId,
  businessName,
  initialMembers,
  allQueues,
}: StaffManagementViewProps) {
  const router = useRouter();
  const [members, setMembers] = useState<StaffMemberRecord[]>(initialMembers);
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingMember, setEditingMember] = useState<StaffMemberRecord | null>(null);
  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  // Add Member Form State
  const [addEmail, setAddEmail] = useState("");
  const [addRole, setAddRole] = useState<"STAFF" | "MANAGER">("STAFF");
  const [addSelectedQueues, setAddSelectedQueues] = useState<string[]>([]);
  const [addError, setAddError] = useState<string | null>(null);

  // Edit Member Form State
  const [editRole, setEditRole] = useState<"STAFF" | "MANAGER">("STAFF");
  const [editSelectedQueues, setEditSelectedQueues] = useState<string[]>([]);
  const [editError, setEditError] = useState<string | null>(null);

  function resetAddForm() {
    setAddEmail("");
    setAddRole("STAFF");
    setAddSelectedQueues([]);
    setAddError(null);
    setIsAddOpen(false);
  }

  function handleOpenEdit(member: StaffMemberRecord) {
    if (member.isOwner) return;
    setEditingMember(member);
    setEditRole(member.role === "MANAGER" ? "MANAGER" : "STAFF");
    setEditSelectedQueues(member.assignedQueues.map((q) => q.id));
    setEditError(null);
  }

  function handleAddSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAddError(null);

    const email = addEmail.trim();
    if (!email) {
      setAddError("Please enter an email address.");
      return;
    }

    startTransition(async () => {
      const res = await addStaffMember({
        businessId,
        email,
        role: addRole,
        queueIds: addRole === "STAFF" ? addSelectedQueues : [],
      });

      if (res.error) {
        setAddError(res.error);
        return;
      }

      resetAddForm();
      router.refresh();
    });
  }

  function handleEditSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingMember) return;
    setEditError(null);

    startTransition(async () => {
      const res = await updateStaffMember({
        businessId,
        memberId: editingMember.id,
        role: editRole,
        queueIds: editRole === "STAFF" ? editSelectedQueues : [],
      });

      if (res.error) {
        setEditError(res.error);
        return;
      }

      setEditingMember(null);
      router.refresh();
    });
  }

  function handleRemove(member: StaffMemberRecord) {
    if (member.isOwner) return;
    if (!confirm(`Are you sure you want to remove ${member.email} from this business?`)) {
      return;
    }

    setActionError(null);
    startTransition(async () => {
      const res = await removeStaffMember({
        businessId,
        memberId: member.id,
      });

      if (res.error) {
        setActionError(res.error);
        return;
      }

      setMembers((prev) => prev.filter((m) => m.id !== member.id));
      router.refresh();
    });
  }

  return (
    <div className="space-y-6">
      {/* Top Breadcrumb & Header */}
      <div>
        <Link
          href={`/businesses/${businessId}`}
          className="text-sm font-medium text-slate-500 hover:text-slate-900"
        >
          ← Back to {businessName}
        </Link>
        <div className="mt-3 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Team & Staff Access</h1>
            <p className="mt-1 text-sm text-slate-600">
              Manage member roles, invitations, and assigned queues for live operations.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setIsAddOpen(true)}
            className="inline-flex items-center justify-center rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-900 focus:ring-offset-2"
          >
            + Add Staff Member
          </button>
        </div>
      </div>

      {actionError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
          {actionError}
        </div>
      )}

      {/* Role explanation callout */}
      <div className="grid gap-4 sm:grid-cols-3">
        <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-purple-100 px-2.5 py-0.5 text-xs font-semibold text-purple-700">
              Owner
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Full business authority. Manages team, creates and deletes queues, views insights, and operates all queues. Cannot be removed.
          </p>
        </div>
        <div className="rounded-xl border border-indigo-100 bg-indigo-50/50 p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-100 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
              Manager
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Operational leader. Views business insights and analytics, operates all queues. Cannot manage staff or delete queues.
          </p>
        </div>
        <div className="rounded-xl border border-blue-100 bg-blue-50/50 p-4">
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
              Staff
            </span>
          </div>
          <p className="mt-2 text-xs text-slate-600">
            Frontline operator. Operates assigned queues only. Blocked from unassigned queues, business insights, analytics, and settings.
          </p>
        </div>
      </div>

      {/* Members Table */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-left text-sm">
            <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3.5">Member</th>
                <th className="px-6 py-3.5">Role</th>
                <th className="px-6 py-3.5">Status</th>
                <th className="px-6 py-3.5">Assigned Queues</th>
                <th className="px-6 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {initialMembers.map((member) => {
                const initials = (member.displayName || member.email)
                  .slice(0, 2)
                  .toUpperCase();

                return (
                  <tr key={member.id} className="hover:bg-slate-50/60 transition-colors">
                    <td className="whitespace-nowrap px-6 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 font-semibold text-xs text-slate-700">
                          {initials}
                        </div>
                        <div>
                          <p className="font-medium text-slate-900">
                            {member.displayName || member.email}
                          </p>
                          {member.displayName && (
                            <p className="text-xs text-slate-500">{member.email}</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          member.role === "OWNER"
                            ? "bg-purple-50 text-purple-700 border border-purple-200"
                            : member.role === "MANAGER"
                            ? "bg-indigo-50 text-indigo-700 border border-indigo-200"
                            : "bg-blue-50 text-blue-700 border border-blue-200"
                        }`}
                      >
                        {member.role}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-6 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          member.status === "ACTIVE"
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-amber-50 text-amber-700 border border-amber-200"
                        }`}
                      >
                        <span
                          className={`h-1.5 w-1.5 rounded-full ${
                            member.status === "ACTIVE" ? "bg-emerald-500" : "bg-amber-500"
                          }`}
                        />
                        {member.status === "ACTIVE" ? "Active" : "Invited"}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      {member.role === "OWNER" || member.role === "MANAGER" ? (
                        <span className="text-xs text-slate-500 font-medium italic">
                          All queues (Full operational access)
                        </span>
                      ) : member.assignedQueues.length === 0 ? (
                        <span className="text-xs text-amber-600 font-medium">
                          No queues assigned (Operational access blocked)
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1.5 max-w-xs">
                          {member.assignedQueues.map((q) => (
                            <span
                              key={q.id}
                              className="rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-700"
                            >
                              {q.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      {member.isOwner ? (
                        <span className="text-xs font-medium text-slate-400">
                          Owner (Protected)
                        </span>
                      ) : (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenEdit(member)}
                            className="rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 shadow-sm hover:bg-slate-50"
                          >
                            Edit Access
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemove(member)}
                            disabled={isPending}
                            className="rounded-md border border-red-200 bg-white px-2.5 py-1 text-xs font-medium text-red-600 shadow-sm hover:bg-red-50 disabled:opacity-50"
                          >
                            Remove
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Staff Modal */}
      {isAddOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="presentation"
          onClick={() => !isPending && setIsAddOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-staff-title"
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="add-staff-title" className="text-lg font-bold text-slate-900">
              Add Team Member
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Invite a staff member or manager to this business. If they do not have an account yet, they will automatically join upon signing in.
            </p>

            <form onSubmit={handleAddSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
                  Email Address
                </label>
                <input
                  type="email"
                  required
                  placeholder="colleague@example.com"
                  value={addEmail}
                  onChange={(e) => setAddEmail(e.target.value)}
                  disabled={isPending}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
                  Role
                </label>
                <select
                  value={addRole}
                  onChange={(e) => setAddRole(e.target.value as "STAFF" | "MANAGER")}
                  disabled={isPending}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-50"
                >
                  <option value="STAFF">Staff (Operates assigned queues only)</option>
                  <option value="MANAGER">Manager (Operates all queues, views insights & analytics)</option>
                </select>
              </div>

              {addRole === "STAFF" && (
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
                      Assigned Queues
                    </label>
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setAddSelectedQueues(allQueues.map((q) => q.id))}
                        className="text-slate-600 hover:text-slate-900 underline"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setAddSelectedQueues([])}
                        className="text-slate-600 hover:text-slate-900 underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Staff members can only view and call tickets for queues they are assigned to.
                  </p>
                  {allQueues.length === 0 ? (
                    <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 italic">
                      No queues have been created for this business yet. You can assign queues later.
                    </p>
                  ) : (
                    <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                      {allQueues.map((queue) => {
                        const checked = addSelectedQueues.includes(queue.id);
                        return (
                          <label
                            key={queue.id}
                            className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer hover:bg-slate-50 p-1 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setAddSelectedQueues((prev) => [...prev, queue.id]);
                                } else {
                                  setAddSelectedQueues((prev) =>
                                    prev.filter((id) => id !== queue.id)
                                  );
                                }
                              }}
                              disabled={isPending}
                              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                            />
                            <span>{queue.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {addError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {addError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={resetAddForm}
                  disabled={isPending}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {isPending ? "Adding..." : "Add Member"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Staff Modal */}
      {editingMember && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-xs"
          role="presentation"
          onClick={() => !isPending && setEditingMember(null)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-staff-title"
            className="w-full max-w-lg rounded-xl border border-slate-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="edit-staff-title" className="text-lg font-bold text-slate-900">
              Edit Access: {editingMember.displayName || editingMember.email}
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              Update role and operational queue assignments for this team member.
            </p>

            <form onSubmit={handleEditSubmit} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
                  Role
                </label>
                <select
                  value={editRole}
                  onChange={(e) => setEditRole(e.target.value as "STAFF" | "MANAGER")}
                  disabled={isPending}
                  className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-slate-900 focus:outline-none focus:ring-1 focus:ring-slate-900 disabled:opacity-50"
                >
                  <option value="STAFF">Staff (Operates assigned queues only)</option>
                  <option value="MANAGER">Manager (Operates all queues, views insights & analytics)</option>
                </select>
              </div>

              {editRole === "STAFF" && (
                <div>
                  <div className="flex items-center justify-between">
                    <label className="block text-xs font-medium uppercase tracking-wider text-slate-500">
                      Assigned Queues
                    </label>
                    <div className="flex gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setEditSelectedQueues(allQueues.map((q) => q.id))}
                        className="text-slate-600 hover:text-slate-900 underline"
                      >
                        Select all
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditSelectedQueues([])}
                        className="text-slate-600 hover:text-slate-900 underline"
                      >
                        Clear
                      </button>
                    </div>
                  </div>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Select the queues this staff member is authorized to view and call.
                  </p>
                  {allQueues.length === 0 ? (
                    <p className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-500 italic">
                      No queues exist for this business yet.
                    </p>
                  ) : (
                    <div className="mt-2 max-h-48 space-y-2 overflow-y-auto rounded-lg border border-slate-200 p-3">
                      {allQueues.map((queue) => {
                        const checked = editSelectedQueues.includes(queue.id);
                        return (
                          <label
                            key={queue.id}
                            className="flex items-center gap-2 text-sm text-slate-800 cursor-pointer hover:bg-slate-50 p-1 rounded"
                          >
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setEditSelectedQueues((prev) => [...prev, queue.id]);
                                } else {
                                  setEditSelectedQueues((prev) =>
                                    prev.filter((id) => id !== queue.id)
                                  );
                                }
                              }}
                              disabled={isPending}
                              className="rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                            />
                            <span>{queue.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {editError && (
                <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                  {editError}
                </div>
              )}

              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingMember(null)}
                  disabled={isPending}
                  className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  {isPending ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
