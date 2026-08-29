"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createQueue } from "@/lib/actions/queue";

export function CreateQueueForm({
  businessId,
  onSuccess,
  onCancel,
}: {
  businessId: string;
  onSuccess?: () => void;
  onCancel?: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [locked, setLocked] = useState(false);

  const busy = pending || locked;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    const trimmedName = name.trim();
    if (!trimmedName) {
      setError("Enter a queue name.");
      return;
    }
    if (trimmedName.length > 100) {
      setError("Queue name must be 100 characters or fewer.");
      return;
    }
    if (description.trim().length > 500) {
      setError("Description must be 500 characters or fewer.");
      return;
    }

    setError(null);
    setLocked(true);

    startTransition(async () => {
      const result = await createQueue({
        businessId,
        name: trimmedName,
        description: description.trim() || undefined,
      });

      if ("error" in result && result.error) {
        setLocked(false);
        setError(result.error);
        return;
      }

      setName("");
      setDescription("");
      onSuccess?.();
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-left">
        <span className="text-sm font-medium text-slate-700">Queue Name</span>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. General Consultation"
          maxLength={100}
          disabled={busy}
          autoComplete="off"
          className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2 disabled:opacity-50"
        />
      </label>

      <label className="flex flex-col gap-1.5 text-left">
        <span className="text-sm font-medium text-slate-700">
          Description <span className="font-normal text-slate-400">(optional)</span>
        </span>
        <textarea
          name="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What is this queue for?"
          maxLength={500}
          rows={3}
          disabled={busy}
          className="resize-none rounded-md border border-slate-200 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2 disabled:opacity-50"
        />
      </label>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <div className="flex items-center justify-end gap-2">
        {onCancel ? (
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="rounded-md border px-4 py-2 text-sm hover:bg-slate-50 disabled:opacity-50"
          >
            Cancel
          </button>
        ) : null}
        <button
          type="submit"
          disabled={busy}
          className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {busy ? "Creating..." : "Create Queue"}
        </button>
      </div>
    </form>
  );
}

export function CreateQueueDialog({
  businessId,
  label = "+ Create Queue",
}: {
  businessId: string;
  label?: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800"
      >
        {label}
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4"
          role="presentation"
          onClick={() => setOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-queue-title"
            className="w-full max-w-md rounded-xl border bg-white p-6 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="create-queue-title" className="text-lg font-semibold">
              Create a queue
            </h2>
            <p className="mt-1 text-sm text-slate-500">
              A queue is a waiting line inside this business. Customers will join it in a later
              phase.
            </p>
            <div className="mt-5">
              <CreateQueueForm
                businessId={businessId}
                onSuccess={() => setOpen(false)}
                onCancel={() => setOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
