"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinQueue } from "@/lib/actions/ticket";

export function CustomerJoinForm({
  businessId,
  queueId,
}: {
  businessId: string;
  queueId: string;
}) {
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
      setError("Enter your name.");
      return;
    }
    if (trimmed.length > 100) {
      setError("Name must be 100 characters or fewer.");
      return;
    }

    setError(null);
    setLocked(true);

    startTransition(async () => {
      const result = await joinQueue({
        businessId,
        queueId,
        customerName: trimmed,
      });

      if ("error" in result && result.error) {
        setLocked(false);
        setError(result.error);
        return;
      }

      if ("ticket" in result && result.ticket) {
        router.push(result.ticket.ticketUrl);
        return;
      }

      setLocked(false);
      setError("Something went wrong. Please try again.");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
      <label className="flex flex-col gap-1.5 text-left">
        <span className="text-sm font-medium text-slate-700">Your Name</span>
        <input
          name="customerName"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Enter your name"
          maxLength={100}
          disabled={busy}
          autoComplete="name"
          className="rounded-md border border-slate-200 px-3 py-2 text-sm outline-none ring-slate-900 focus:ring-2 disabled:opacity-50"
        />
      </label>

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-slate-900 px-4 py-2.5 text-sm font-medium text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {busy ? "Joining..." : "Join Queue"}
      </button>
    </form>
  );
}
