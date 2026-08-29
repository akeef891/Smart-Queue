"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createWorkspace } from "@/lib/actions/workspace";

export function CreateWorkspaceForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [locked, setLocked] = useState(false);

  const busy = pending || locked;

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter a workspace name.");
      return;
    }
    if (trimmed.length > 100) {
      setError("Workspace name must be 100 characters or fewer.");
      return;
    }

    setError(null);
    setLocked(true);

    startTransition(async () => {
      const result = await createWorkspace({ name: trimmed });
      if ("error" in result && result.error) {
        setLocked(false);
        setError(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-left">
        <span className="text-sm font-medium text-slate-700">Workspace Name</span>
        <input
          name="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Downtown Clinic"
          maxLength={100}
          disabled={busy}
          autoComplete="organization"
          className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2 disabled:opacity-50"
        />
      </label>

      {error && (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Creating..." : "Create Workspace"}
      </button>
    </form>
  );
}
