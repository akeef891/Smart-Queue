"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteQueue, updateQueue, updateQueueStatus } from "@/lib/actions/queue";

export function QueueManagePanel({
  businessId,
  queueId,
  name,
  description,
  status,
}: {
  businessId: string;
  queueId: string;
  name: string;
  description: string | null;
  status: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [queueName, setQueueName] = useState(name);
  const [queueDescription, setQueueDescription] = useState(description ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [locked, setLocked] = useState(false);

  const busy = pending || locked;
  const isActive = status === "ACTIVE";

  function run(action: () => Promise<{ error?: string } | { ok?: true } | { queue?: unknown }>) {
    if (busy) return;
    setError(null);
    setLocked(true);
    startTransition(async () => {
      const result = await action();
      if ("error" in result && result.error) {
        setLocked(false);
        setError(result.error);
        return;
      }
      setLocked(false);
      router.refresh();
    });
  }

  function handleSave(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = queueName.trim();
    if (!trimmed) {
      setError("Enter a queue name.");
      return;
    }
    if (trimmed.length > 100) {
      setError("Queue name must be 100 characters or fewer.");
      return;
    }
    if (queueDescription.trim().length > 500) {
      setError("Description must be 500 characters or fewer.");
      return;
    }

    run(async () => {
      const result = await updateQueue({
        businessId,
        queueId,
        name: trimmed,
        description: queueDescription.trim() || undefined,
      });
      if (!("error" in result && result.error)) {
        setEditing(false);
      }
      return result;
    });
  }

  function handleToggleStatus() {
    const next = isActive ? "INACTIVE" : "ACTIVE";
    const confirmed = window.confirm(
      isActive
        ? "Deactivate this queue? It will no longer count as an active queue."
        : "Activate this queue?"
    );
    if (!confirmed) return;
    run(() => updateQueueStatus({ businessId, queueId, status: next }));
  }

  function handleDelete() {
    const confirmed = window.confirm(
      "Delete this queue? This cannot be undone. The parent business will not be deleted."
    );
    if (!confirmed) return;
    setError(null);
    setLocked(true);
    startTransition(async () => {
      const result = await deleteQueue({ businessId, queueId });
      if ("error" in result && result.error) {
        setLocked(false);
        setError(result.error);
        return;
      }
      router.push(`/businesses/${businessId}`);
      router.refresh();
    });
  }

  return (
    <section className="mt-6 rounded-xl border bg-white p-6">
      <div className="flex flex-wrap items-center gap-2">
        {!editing ? (
          <button
            type="button"
            onClick={() => setEditing(true)}
            disabled={busy}
            className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Edit
          </button>
        ) : null}
        <button
          type="button"
          onClick={handleToggleStatus}
          disabled={busy}
          className="rounded-md border px-3 py-1.5 text-sm hover:bg-slate-50 disabled:opacity-50"
        >
          {busy ? "Saving..." : isActive ? "Deactivate" : "Activate"}
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="rounded-md border border-red-200 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      {error ? (
        <p className="mt-3 text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      {editing ? (
        <form onSubmit={handleSave} className="mt-5 flex flex-col gap-4">
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">Queue Name</span>
            <input
              value={queueName}
              onChange={(e) => setQueueName(e.target.value)}
              maxLength={100}
              disabled={busy}
              className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2 disabled:opacity-50"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-slate-700">Description</span>
            <textarea
              value={queueDescription}
              onChange={(e) => setQueueDescription(e.target.value)}
              maxLength={500}
              rows={3}
              disabled={busy}
              className="resize-none rounded-md border border-slate-200 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2 disabled:opacity-50"
            />
          </label>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setQueueName(name);
                setQueueDescription(description ?? "");
                setError(null);
              }}
              disabled={busy}
              className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={busy}
              className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {busy ? "Saving..." : "Save changes"}
            </button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
