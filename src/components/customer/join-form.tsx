"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { joinQueue } from "@/lib/actions/ticket";

export function JoinForm({ queueId, businessId }: { queueId: string; businessId?: string }) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [locked, setLocked] = useState(false);

  const busy = pending || locked;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;

    const trimmed = name.trim();
    if (!trimmed) {
      setError("Enter your name.");
      return;
    }

    setError(null);
    setLocked(true);

    startTransition(async () => {
      const result = await joinQueue({
        queueId,
        businessId,
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
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <input
        className="rounded-md border px-3 py-2 text-sm"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        maxLength={100}
        disabled={busy}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
      <button
        type="submit"
        disabled={busy}
        className="rounded-md bg-slate-900 py-2 text-sm font-medium text-white disabled:opacity-50"
      >
        {busy ? "Joining..." : "Join Queue"}
      </button>
    </form>
  );
}
