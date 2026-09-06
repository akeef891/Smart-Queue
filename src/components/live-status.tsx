export function LiveStatus({ status }: { status: "off" | "connecting" | "live" | "reconnecting" }) {
  const label =
    status === "live"
      ? "Live"
      : status === "connecting"
        ? "Connecting"
        : status === "reconnecting"
          ? "Reconnecting"
          : "Realtime off";

  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
      <span
        className={
          status === "live"
            ? "h-1.5 w-1.5 rounded-full bg-emerald-500"
            : status === "off"
              ? "h-1.5 w-1.5 rounded-full bg-slate-300"
              : "h-1.5 w-1.5 rounded-full bg-slate-400"
        }
      />
      {label}
    </span>
  );
}
