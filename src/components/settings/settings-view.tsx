"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type {
  BusinessSettingsSnapshot,
  DayOfWeek,
  WeeklyOperatingHours,
} from "@/lib/settings-types";
import {
  updateBusinessProfile,
  updateQueueDefaults,
  updateCustomerExperience,
  updateDisplaySettings,
  updateOperatingHours,
  pauseAllQueues,
  archiveBusiness,
  deleteBusiness,
} from "@/lib/actions/settings";
import {
  Building2,
  Sliders,
  Users,
  Tv,
  Clock,
  AlertTriangle,
  CheckCircle2,
  AlertCircle,
  Save,
  Pause,
  Archive,
  Trash2,
} from "lucide-react";
import { LogoUploader } from "./logo-uploader";
import { getAllTimezoneOptions } from "@/lib/timezones";

const timezoneOptions = getAllTimezoneOptions();

type SettingsTab =
  | "profile"
  | "queue-defaults"
  | "customer"
  | "display"
  | "operating-hours"
  | "danger";

const DAYS: { key: DayOfWeek; label: string }[] = [
  { key: "monday", label: "Monday" },
  { key: "tuesday", label: "Tuesday" },
  { key: "wednesday", label: "Wednesday" },
  { key: "thursday", label: "Thursday" },
  { key: "friday", label: "Friday" },
  { key: "saturday", label: "Saturday" },
  { key: "sunday", label: "Sunday" },
];

export function SettingsView({ initial }: { initial: BusinessSettingsSnapshot }) {
  const router = useRouter();
  const [tab, setTab] = useState<SettingsTab>("profile");
  const isOwner = initial.userRole === "OWNER";

  // Form states
  const [profile, setProfile] = useState(initial.profile);
  const [queueDefaults, setQueueDefaults] = useState(initial.queueDefaults);
  const [customerExp, setCustomerExp] = useState(initial.customerExperience);
  const [display, setDisplay] = useState(initial.displaySettings);
  const [hours, setHours] = useState<WeeklyOperatingHours>(initial.operatingHours);

  // Status feedback
  const [statusMessage, setStatusMessage] = useState<{
    type: "success" | "error";
    text: string;
  } | null>(null);
  const [pending, startTransition] = useTransition();

  // Danger zone confirmation modals
  const [confirmPauseAll, setConfirmPauseAll] = useState(false);
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  function showMessage(type: "success" | "error", text: string) {
    setStatusMessage({ type, text });
    if (type === "success") {
      setTimeout(() => setStatusMessage(null), 4000);
    }
  }

  // Save Handlers
  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!isOwner || pending) return;
    setStatusMessage(null);

    startTransition(async () => {
      const res = await updateBusinessProfile(initial.businessId, profile);
      if ("error" in res && res.error) {
        showMessage("error", res.error);
      } else {
        showMessage("success", "Business profile updated successfully.");
        router.refresh();
      }
    });
  }

  function handleSaveQueueDefaults(e: React.FormEvent) {
    e.preventDefault();
    if (!isOwner || pending) return;
    setStatusMessage(null);

    startTransition(async () => {
      const res = await updateQueueDefaults(initial.businessId, queueDefaults);
      if ("error" in res && res.error) {
        showMessage("error", res.error);
      } else {
        showMessage("success", "Queue default settings saved successfully.");
        router.refresh();
      }
    });
  }

  function handleSaveCustomerExp(e: React.FormEvent) {
    e.preventDefault();
    if (!isOwner || pending) return;
    setStatusMessage(null);

    startTransition(async () => {
      const res = await updateCustomerExperience(initial.businessId, customerExp);
      if ("error" in res && res.error) {
        showMessage("error", res.error);
      } else {
        showMessage("success", "Customer experience settings saved successfully.");
        router.refresh();
      }
    });
  }

  function handleSaveDisplay(e: React.FormEvent) {
    e.preventDefault();
    if (!isOwner || pending) return;
    setStatusMessage(null);

    startTransition(async () => {
      const res = await updateDisplaySettings(initial.businessId, display);
      if ("error" in res && res.error) {
        showMessage("error", res.error);
      } else {
        showMessage("success", "TV Display settings saved and broadcasted to active screens.");
        router.refresh();
      }
    });
  }

  function handleSaveHours(e: React.FormEvent) {
    e.preventDefault();
    if (!isOwner || pending) return;
    setStatusMessage(null);

    startTransition(async () => {
      const res = await updateOperatingHours(initial.businessId, hours);
      if ("error" in res && res.error) {
        showMessage("error", res.error);
      } else {
        showMessage("success", "Operating hours schedule saved successfully.");
        router.refresh();
      }
    });
  }

  function handlePauseAll() {
    if (!isOwner || pending) return;
    startTransition(async () => {
      const res = await pauseAllQueues(initial.businessId);
      setConfirmPauseAll(false);
      if ("error" in res) {
        showMessage("error", res.error);
      } else {
        showMessage("success", `All queues have been paused (${res.count} queues updated).`);
        router.refresh();
      }
    });
  }

  function handleArchive() {
    if (!isOwner || pending) return;
    startTransition(async () => {
      const res = await archiveBusiness(initial.businessId);
      setConfirmArchive(false);
      if ("error" in res && res.error) {
        showMessage("error", res.error);
      } else {
        showMessage("success", "Business archived successfully.");
        router.push("/businesses");
      }
    });
  }

  function handleDelete() {
    if (!isOwner || pending) return;
    startTransition(async () => {
      const res = await deleteBusiness(initial.businessId);
      setConfirmDelete(false);
      if ("error" in res && res.error) {
        showMessage("error", res.error);
      } else {
        router.push("/businesses");
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Header breadcrumbs & title */}
      <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Link
            href={`/businesses/${initial.businessId}`}
            className="text-xs font-medium text-slate-500 hover:text-slate-800 transition"
          >
            ← Back to {profile.name}
          </Link>
          <h2 className="mt-1 text-2xl font-bold tracking-tight text-slate-900">
            Business Settings
          </h2>
          <p className="text-sm text-slate-500">
            Configure business identity, queue defaults, customer touchpoints, and TV displays.
          </p>
        </div>
      </div>

      {/* Role Notice for Manager */}
      {!isOwner ? (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 p-4 text-blue-800 text-sm">
          <AlertCircle className="h-5 w-5 shrink-0 text-blue-600 mt-0.5" />
          <div>
            <p className="font-semibold">Read-Only Access (Manager Role)</p>
            <p className="mt-0.5 text-blue-700">
              You are currently viewing business configurations as a Manager. Only the workspace Owner has permission to update settings or perform danger zone operations.
            </p>
          </div>
        </div>
      ) : null}

      {/* Feedback Banner */}
      {statusMessage ? (
        <div
          className={`flex items-center gap-3 rounded-xl border p-4 text-sm font-medium ${
            statusMessage.type === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-red-200 bg-red-50 text-red-800"
          }`}
          role="alert"
        >
          {statusMessage.type === "success" ? (
            <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald-600" />
          ) : (
            <AlertCircle className="h-5 w-5 shrink-0 text-red-600" />
          )}
          <span>{statusMessage.text}</span>
        </div>
      ) : null}

      {/* Main Settings Layout: Sidebar Tabs + Panel */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
        {/* Navigation Sidebar */}
        <nav className="flex flex-col gap-1 rounded-xl border border-slate-200 bg-white p-2 lg:sticky lg:top-6 self-start">
          <button
            type="button"
            onClick={() => setTab("profile")}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              tab === "profile"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Building2 className="h-4 w-4" />
            <span>Business Profile</span>
          </button>

          <button
            type="button"
            onClick={() => setTab("queue-defaults")}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              tab === "queue-defaults"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Sliders className="h-4 w-4" />
            <span>Queue Defaults</span>
          </button>

          <button
            type="button"
            onClick={() => setTab("customer")}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              tab === "customer"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Users className="h-4 w-4" />
            <span>Customer Experience</span>
          </button>

          <button
            type="button"
            onClick={() => setTab("display")}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              tab === "display"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Tv className="h-4 w-4" />
            <span>TV / Display Mode</span>
          </button>

          <button
            type="button"
            onClick={() => setTab("operating-hours")}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
              tab === "operating-hours"
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            <Clock className="h-4 w-4" />
            <span>Operating Hours</span>
          </button>

          {isOwner ? (
            <button
              type="button"
              onClick={() => setTab("danger")}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition mt-4 border-t border-slate-100 pt-3 ${
                tab === "danger"
                  ? "bg-red-600 text-white shadow-sm"
                  : "text-red-600 hover:bg-red-50"
              }`}
            >
              <AlertTriangle className="h-4 w-4" />
              <span>Danger Zone</span>
            </button>
          ) : null}
        </nav>

        {/* Content Panel */}
        <div className="lg:col-span-3">
          {/* TAB 1: BUSINESS PROFILE */}
          {tab === "profile" ? (
            <form onSubmit={handleSaveProfile} className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-semibold text-slate-900">Business Profile</h3>
                <p className="text-sm text-slate-500">
                  Update public details and contact information for this business location.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Business Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isOwner || pending}
                    value={profile.name}
                    onChange={(e) => setProfile({ ...profile, name: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 outline-none ring-slate-900 focus:ring-2 disabled:bg-slate-50"
                    maxLength={100}
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Category / Type
                  </label>
                  <select
                    disabled={!isOwner || pending}
                    value={profile.type}
                    onChange={(e) => setProfile({ ...profile, type: e.target.value as any })}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none ring-slate-900 focus:ring-2 disabled:bg-slate-50"
                  >
                    <option value="CLINIC">Clinic</option>
                    <option value="HOSPITAL">Hospital</option>
                    <option value="SALON">Salon</option>
                    <option value="RESTAURANT">Restaurant</option>
                    <option value="BANK">Bank</option>
                    <option value="GOVERNMENT">Government Office</option>
                    <option value="DIAGNOSTIC_CENTER">Diagnostic Center</option>
                    <option value="TUITION_CENTER">Tuition Center</option>
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Timezone <span className="text-red-500">*</span>
                  </label>
                  <select
                    disabled={!isOwner || pending}
                    value={profile.timezone}
                    onChange={(e) => setProfile({ ...profile, timezone: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none ring-slate-900 focus:ring-2 disabled:bg-slate-50"
                  >
                    <optgroup label="Popular & Recommended">
                      {timezoneOptions
                        .filter((opt) => opt.group === "Popular & Recommended")
                        .map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                    </optgroup>
                    <optgroup label="All Timezones (IANA)">
                      {timezoneOptions
                        .filter((opt) => opt.group === "All Timezones (IANA)")
                        .map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                    </optgroup>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Email Address
                  </label>
                  <input
                    type="email"
                    disabled={!isOwner || pending}
                    value={profile.email || ""}
                    onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 outline-none ring-slate-900 focus:ring-2 disabled:bg-slate-50"
                    placeholder="contact@business.com"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Phone Number
                  </label>
                  <input
                    type="tel"
                    disabled={!isOwner || pending}
                    value={profile.phone || ""}
                    onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 outline-none ring-slate-900 focus:ring-2 disabled:bg-slate-50"
                    placeholder="+1 (555) 000-0000"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Physical Address
                  </label>
                  <input
                    type="text"
                    disabled={!isOwner || pending}
                    value={profile.address || ""}
                    onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 outline-none ring-slate-900 focus:ring-2 disabled:bg-slate-50"
                    placeholder="123 Main St, Suite 100, City, State"
                  />
                </div>

                <div className="sm:col-span-2">
                  <LogoUploader
                    businessId={initial.businessId}
                    initialLogoUrl={profile.logoUrl || null}
                    isReadOnly={!isOwner}
                    onLogoChange={(url) => setProfile((p) => ({ ...p, logoUrl: url }))}
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Description
                  </label>
                  <textarea
                    rows={3}
                    disabled={!isOwner || pending}
                    value={profile.description || ""}
                    onChange={(e) => setProfile({ ...profile, description: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 outline-none ring-slate-900 focus:ring-2 disabled:bg-slate-50"
                    placeholder="Brief description of your business services..."
                  />
                </div>
              </div>

              {isOwner ? (
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    <span>{pending ? "Saving..." : "Save Profile"}</span>
                  </button>
                </div>
              ) : null}
            </form>
          ) : null}

          {/* TAB 2: QUEUE DEFAULTS */}
          {tab === "queue-defaults" ? (
            <form onSubmit={handleSaveQueueDefaults} className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-semibold text-slate-900">Queue Defaults</h3>
                <p className="text-sm text-slate-500">
                  Configure default operational rules, timing, and ticket lifecycle controls.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Default Queue Name
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isOwner || pending}
                    value={queueDefaults.defaultQueueName}
                    onChange={(e) =>
                      setQueueDefaults({ ...queueDefaults, defaultQueueName: e.target.value })
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 outline-none ring-slate-900 focus:ring-2 disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Default Service Time (minutes)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={720}
                    required
                    disabled={!isOwner || pending}
                    value={queueDefaults.defaultServiceTime}
                    onChange={(e) =>
                      setQueueDefaults({
                        ...queueDefaults,
                        defaultServiceTime: parseInt(e.target.value, 10) || 10,
                      })
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 outline-none ring-slate-900 focus:ring-2 disabled:bg-slate-50"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Default Max Queue Capacity
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={10000}
                    disabled={!isOwner || pending}
                    value={queueDefaults.maxQueueCapacity ?? ""}
                    onChange={(e) =>
                      setQueueDefaults({
                        ...queueDefaults,
                        maxQueueCapacity: e.target.value ? parseInt(e.target.value, 10) : null,
                      })
                    }
                    placeholder="Unlimited if left empty"
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 outline-none ring-slate-900 focus:ring-2 disabled:bg-slate-50"
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Leave blank to allow unlimited customers to join unless set on individual queues.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    No-Show Handling Mode
                  </label>
                  <select
                    disabled={!isOwner || pending}
                    value={queueDefaults.noShowHandling}
                    onChange={(e) =>
                      setQueueDefaults({ ...queueDefaults, noShowHandling: e.target.value })
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3.5 py-2 text-sm text-slate-900 outline-none ring-slate-900 focus:ring-2 disabled:bg-slate-50"
                  >
                    <option value="MANUAL">Manual (Staff manually marks No-Show)</option>
                    <option value="AUTO_CANCEL">Auto-Cancel on Skip</option>
                    <option value="HOLD_FOR_MINUTES">Hold in Pending</option>
                  </select>
                </div>
              </div>

              {/* Behavior Toggles */}
              <div className="space-y-3 pt-4 border-t border-slate-100">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isOwner || pending}
                    checked={queueDefaults.allowCustomerLeave}
                    onChange={(e) =>
                      setQueueDefaults({ ...queueDefaults, allowCustomerLeave: e.target.checked })
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-800">
                      Allow customers to leave queue
                    </span>
                    <p className="text-xs text-slate-500">
                      When enabled, customers can cancel their ticket and leave directly from their live ticket screen.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isOwner || pending}
                    checked={queueDefaults.allowCustomerRejoin}
                    onChange={(e) =>
                      setQueueDefaults({ ...queueDefaults, allowCustomerRejoin: e.target.checked })
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-800">
                      Allow customer rejoin
                    </span>
                    <p className="text-xs text-slate-500">
                      Allow customers who recently left or were skipped to request a new ticket.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isOwner || pending}
                    checked={queueDefaults.autoExpireStaleTickets}
                    onChange={(e) =>
                      setQueueDefaults({
                        ...queueDefaults,
                        autoExpireStaleTickets: e.target.checked,
                      })
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-800">
                      Auto-expire stale tickets at end of day
                    </span>
                    <p className="text-xs text-slate-500">
                      Automatically mark unserved tickets as cancelled after business hours.
                    </p>
                  </div>
                </label>
              </div>

              {isOwner ? (
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    <span>{pending ? "Saving..." : "Save Queue Defaults"}</span>
                  </button>
                </div>
              ) : null}
            </form>
          ) : null}

          {/* TAB 3: CUSTOMER EXPERIENCE */}
          {tab === "customer" ? (
            <form onSubmit={handleSaveCustomerExp} className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-semibold text-slate-900">Customer Experience</h3>
                <p className="text-sm text-slate-500">
                  Personalize the join screen, notifications, and instructions seen by waiting customers.
                </p>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Welcome Message
                  </label>
                  <textarea
                    rows={2}
                    disabled={!isOwner || pending}
                    value={customerExp.welcomeMessage || ""}
                    onChange={(e) =>
                      setCustomerExp({ ...customerExp, welcomeMessage: e.target.value })
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 outline-none ring-slate-900 focus:ring-2 disabled:bg-slate-50"
                    placeholder="Welcome! Please enter your name to secure your spot in line."
                    maxLength={300}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Displayed prominently on the public Join Queue page before registration.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Queue Instructions
                  </label>
                  <textarea
                    rows={3}
                    disabled={!isOwner || pending}
                    value={customerExp.queueInstructions || ""}
                    onChange={(e) =>
                      setCustomerExp({ ...customerExp, queueInstructions: e.target.value })
                    }
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 outline-none ring-slate-900 focus:ring-2 disabled:bg-slate-50"
                    placeholder="Please take a seat in the waiting area. Watch the TV display or keep this tab open to monitor your ticket."
                    maxLength={500}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Helpful guidelines shown on the join screen and ticket screen.
                  </p>
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-100">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isOwner || pending}
                      checked={customerExp.enableNotifications}
                      onChange={(e) =>
                        setCustomerExp({ ...customerExp, enableNotifications: e.target.checked })
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <div>
                      <span className="text-sm font-semibold text-slate-800">
                        Enable customer queue notifications
                      </span>
                      <p className="text-xs text-slate-500">
                        Send web push alerts and chime notifications when a customer is called or next in line.
                      </p>
                    </div>
                  </label>

                  <label className="flex items-start gap-3 cursor-pointer">
                    <input
                      type="checkbox"
                      disabled={!isOwner || pending}
                      checked={customerExp.enableQrJoin}
                      onChange={(e) =>
                        setCustomerExp({ ...customerExp, enableQrJoin: e.target.checked })
                      }
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                    />
                    <div>
                      <span className="text-sm font-semibold text-slate-800">
                        Enable QR Joining
                      </span>
                      <p className="text-xs text-slate-500">
                        Show QR codes on TV screens and physical counter prints to let customers scan to join.
                      </p>
                    </div>
                  </label>
                </div>
              </div>

              {isOwner ? (
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    <span>{pending ? "Saving..." : "Save Customer Settings"}</span>
                  </button>
                </div>
              ) : null}
            </form>
          ) : null}

          {/* TAB 4: DISPLAY SETTINGS */}
          {tab === "display" ? (
            <form onSubmit={handleSaveDisplay} className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-semibold text-slate-900">TV / Display Mode Settings</h3>
                <p className="text-sm text-slate-500">
                  Control the layout, elements, and branding displayed on waiting room TV screens.
                </p>
              </div>

              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Display Header Title
                  </label>
                  <input
                    type="text"
                    required
                    disabled={!isOwner || pending}
                    value={display.displayTitle}
                    onChange={(e) => setDisplay({ ...display, displayTitle: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 outline-none ring-slate-900 focus:ring-2 disabled:bg-slate-50"
                    placeholder="Now Serving"
                    maxLength={60}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Overrides queue name as the main title on TV display.
                  </p>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                    Custom Branding Text
                  </label>
                  <input
                    type="text"
                    disabled={!isOwner || pending}
                    value={display.brandingText || ""}
                    onChange={(e) => setDisplay({ ...display, brandingText: e.target.value })}
                    className="mt-1.5 w-full rounded-lg border border-slate-200 px-3.5 py-2 text-sm text-slate-900 outline-none ring-slate-900 focus:ring-2 disabled:bg-slate-50"
                    placeholder="e.g. Acme Health Clinic"
                    maxLength={100}
                  />
                  <p className="mt-1 text-xs text-slate-400">
                    Shown above the display title and in the TV footer bar.
                  </p>
                </div>
              </div>

              <div className="space-y-3 pt-4 border-t border-slate-100">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isOwner || pending}
                    checked={display.showQrCode}
                    onChange={(e) => setDisplay({ ...display, showQrCode: e.target.checked })}
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-800">
                      Show Join QR Code on Display
                    </span>
                    <p className="text-xs text-slate-500">
                      Display a live QR code in the bottom corner of the TV screen for walk-in scanning.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isOwner || pending}
                    checked={display.showCurrentlyServing}
                    onChange={(e) =>
                      setDisplay({ ...display, showCurrentlyServing: e.target.checked })
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-800">
                      Show Currently Serving Hero Card
                    </span>
                    <p className="text-xs text-slate-500">
                      Show the large ticket hero card when a customer ticket is being served.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isOwner || pending}
                    checked={display.showWaitingCount}
                    onChange={(e) =>
                      setDisplay({ ...display, showWaitingCount: e.target.checked })
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-800">
                      Show Total Waiting Count Badge
                    </span>
                    <p className="text-xs text-slate-500">
                      Display total count of waiting customers in the &quot;Next in Line&quot; section.
                    </p>
                  </div>
                </label>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    disabled={!isOwner || pending}
                    checked={display.soundAlertEnabled}
                    onChange={(e) =>
                      setDisplay({ ...display, soundAlertEnabled: e.target.checked })
                    }
                    className="mt-1 h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                  />
                  <div>
                    <span className="text-sm font-semibold text-slate-800">
                      Enable TV Attention Chime
                    </span>
                    <p className="text-xs text-slate-500">
                      Play an audio notification chime when a new ticket number is called.
                    </p>
                  </div>
                </label>
              </div>

              {isOwner ? (
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    <span>{pending ? "Saving..." : "Save & Broadcast to TV"}</span>
                  </button>
                </div>
              ) : null}
            </form>
          ) : null}

          {/* TAB 5: OPERATING HOURS */}
          {tab === "operating-hours" ? (
            <form onSubmit={handleSaveHours} className="rounded-xl border border-slate-200 bg-white p-6 space-y-6">
              <div className="border-b border-slate-100 pb-4">
                <h3 className="text-lg font-semibold text-slate-900">Operating Hours Schedule</h3>
                <p className="text-sm text-slate-500">
                  Set daily opening and closing hours. This schedule is displayed to customers and staff.
                </p>
              </div>

              <div className="divide-y divide-slate-100">
                {DAYS.map(({ key, label }) => {
                  const daySched = hours[key] || {
                    isOpen: false,
                    openTime: "09:00",
                    closeTime: "17:00",
                  };

                  return (
                    <div key={key} className="py-3.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="w-32">
                        <span className="text-sm font-semibold text-slate-800">{label}</span>
                      </div>

                      <div className="flex items-center gap-4">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            disabled={!isOwner || pending}
                            checked={daySched.isOpen}
                            onChange={(e) => {
                              const next = { ...hours };
                              next[key] = {
                                ...daySched,
                                isOpen: e.target.checked,
                              };
                              setHours(next);
                            }}
                            className="h-4 w-4 rounded border-slate-300 text-slate-900 focus:ring-slate-900"
                          />
                          <span
                            className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                              daySched.isOpen
                                ? "bg-emerald-50 text-emerald-700"
                                : "bg-slate-100 text-slate-500"
                            }`}
                          >
                            {daySched.isOpen ? "Open" : "Closed"}
                          </span>
                        </label>

                        {daySched.isOpen ? (
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              disabled={!isOwner || pending}
                              value={daySched.openTime}
                              onChange={(e) => {
                                const next = { ...hours };
                                next[key] = { ...daySched, openTime: e.target.value };
                                setHours(next);
                              }}
                              className="rounded-md border border-slate-200 px-2.5 py-1 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-slate-900"
                            />
                            <span className="text-xs text-slate-400">to</span>
                            <input
                              type="time"
                              disabled={!isOwner || pending}
                              value={daySched.closeTime}
                              onChange={(e) => {
                                const next = { ...hours };
                                next[key] = { ...daySched, closeTime: e.target.value };
                                setHours(next);
                              }}
                              className="rounded-md border border-slate-200 px-2.5 py-1 text-sm text-slate-800 outline-none focus:ring-2 focus:ring-slate-900"
                            />
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 italic">No service hours scheduled</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {isOwner ? (
                <div className="flex justify-end pt-4 border-t border-slate-100">
                  <button
                    type="submit"
                    disabled={pending}
                    className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 transition disabled:opacity-50"
                  >
                    <Save className="h-4 w-4" />
                    <span>{pending ? "Saving..." : "Save Operating Hours"}</span>
                  </button>
                </div>
              ) : null}
            </form>
          ) : null}

          {/* TAB 6: DANGER ZONE (OWNER ONLY) */}
          {tab === "danger" && isOwner ? (
            <div className="rounded-xl border border-red-200 bg-white p-6 space-y-6">
              <div className="border-b border-red-100 pb-4">
                <div className="flex items-center gap-2 text-red-600">
                  <AlertTriangle className="h-5 w-5" />
                  <h3 className="text-lg font-semibold">Danger Zone</h3>
                </div>
                <p className="text-sm text-slate-500 mt-1">
                  High-impact operational and administrative business governance actions. These actions require explicit confirmation.
                </p>
              </div>

              {/* Action 1: Pause all queues */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border border-amber-200 bg-amber-50/50">
                <div>
                  <h4 className="text-sm font-bold text-amber-950">Pause All Queues</h4>
                  <p className="text-xs text-amber-800 mt-0.5">
                    Immediately halts customer joins and changes status to PAUSED on all queues under this business.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmPauseAll(true)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-amber-400 bg-amber-100 px-3.5 py-2 text-xs font-bold text-amber-900 hover:bg-amber-200 transition"
                >
                  <Pause className="h-3.5 w-3.5" />
                  <span>Pause All Queues</span>
                </button>
              </div>

              {/* Action 2: Archive business */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50">
                <div>
                  <h4 className="text-sm font-bold text-slate-900">Archive Business</h4>
                  <p className="text-xs text-slate-600 mt-0.5">
                    Hides this business from the active listing and pauses its queues. You will be redirected back to the businesses overview.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmArchive(true)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-bold text-slate-800 hover:bg-slate-100 transition"
                >
                  <Archive className="h-3.5 w-3.5" />
                  <span>Archive Business</span>
                </button>
              </div>

              {/* Action 3: Delete business */}
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 p-4 rounded-xl border border-red-200 bg-red-50/40">
                <div>
                  <h4 className="text-sm font-bold text-red-950">Permanently Delete Business</h4>
                  <p className="text-xs text-red-800 mt-0.5">
                    Deletes this business, its queues, tickets, team assignments, and settings. This action is irreversible.
                  </p>
                </div>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => setConfirmDelete(true)}
                  className="inline-flex shrink-0 items-center gap-2 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-bold text-white hover:bg-red-700 transition"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>Delete Business</span>
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      {/* CONFIRMATION MODALS */}
      {confirmPauseAll ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Pause All Queues?</h3>
            <p className="text-sm text-slate-600">
              Are you sure you want to pause all active queues for <strong>{profile.name}</strong>? Customers will not be able to join until individual queues are resumed.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmPauseAll(false)}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handlePauseAll}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white hover:bg-amber-700"
              >
                {pending ? "Pausing..." : "Yes, Pause All"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmArchive ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-slate-900">Archive Business?</h3>
            <p className="text-sm text-slate-600">
              Archiving <strong>{profile.name}</strong> will deactivate its public queues and remove it from active business selector.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmArchive(false)}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleArchive}
                className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                {pending ? "Archiving..." : "Yes, Archive"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {confirmDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-red-200 bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="h-5 w-5" />
              <h3 className="text-base font-bold">Permanently Delete Business?</h3>
            </div>
            <p className="text-sm text-slate-600">
              This action cannot be undone. All queues, active tickets, history, staff assignments, and configurations under <strong>{profile.name}</strong> will be permanently purged.
            </p>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                disabled={pending}
                onClick={() => setConfirmDelete(false)}
                className="rounded-lg border px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={handleDelete}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700"
              >
                {pending ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
