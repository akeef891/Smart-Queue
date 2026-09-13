"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getPublicQueueDisplaySnapshot,
  type PublicQueueDisplaySnapshot,
} from "@/lib/actions/ticket";
import { useQueueRealtime } from "@/hooks/use-queue-realtime";
import { playNotificationSound } from "@/lib/notifications";
import { LiveStatus } from "@/components/live-status";
import {
  Maximize2,
  Minimize2,
  Volume2,
  VolumeX,
  Users,
  Clock,
  Sparkles,
  QrCode,
} from "lucide-react";

export function QueueDisplay({
  initial,
  businessId,
  queueId,
  joinUrl,
  joinQrDataUrl,
}: {
  initial: PublicQueueDisplaySnapshot;
  businessId: string;
  queueId: string;
  joinUrl: string;
  joinQrDataUrl?: string | null;
}) {
  const [snapshot, setSnapshot] = useState<PublicQueueDisplaySnapshot>(initial);
  const [isMuted, setIsMuted] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentTime, setCurrentTime] = useState<string>("");
  const [isNewCallAnimating, setIsNewCallAnimating] = useState(false);

  const prevCalledRef = useRef<string | null>(initial.currentlyCalled);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Digital clock update
  useEffect(() => {
    function updateClock() {
      const now = new Date();
      setCurrentTime(
        now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
      );
    }
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  // Track Fullscreen status
  useEffect(() => {
    function handleFullscreenChange() {
      setIsFullscreen(Boolean(document.fullscreenElement));
    }
    document.addEventListener("fullscreenchange", handleFullscreenChange);
    return () => {
      document.removeEventListener("fullscreenchange", handleFullscreenChange);
    };
  }, []);

  // Realtime refresh callback
  const refresh = useCallback(() => {
    void getPublicQueueDisplaySnapshot(businessId, queueId).then((result) => {
      if ("snapshot" in result && result.snapshot) {
        setSnapshot(result.snapshot);
      }
    });
  }, [businessId, queueId]);

  const liveStatus = useQueueRealtime(queueId, refresh);

  // Trigger attention chime and animation when currentlyCalled changes
  useEffect(() => {
    const currentCalled = snapshot.currentlyCalled;
    const prevCalled = prevCalledRef.current;

    if (currentCalled && currentCalled !== prevCalled) {
      // Trigger animation
      setIsNewCallAnimating(true);
      if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
      animationTimerRef.current = setTimeout(() => {
        setIsNewCallAnimating(false);
      }, 3500);

      // Trigger audio chime if unmuted and soundAlertEnabled is not false
      if (!isMuted && snapshot.soundAlertEnabled !== false) {
        playNotificationSound("called");
      }
    }

    prevCalledRef.current = currentCalled;
  }, [snapshot.currentlyCalled, snapshot.soundAlertEnabled, isMuted]);

  // Toggle Fullscreen safely
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {
        // Fullscreen request denied or unsupported
      });
    } else {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {
          // Exit fullscreen failed
        });
      }
    }
  }

  const activeTicket =
    snapshot.currentlyCalled ||
    (snapshot.showCurrentlyServing !== false ? snapshot.currentlyServing : null);
  const isCalled = Boolean(snapshot.currentlyCalled);
  const hasWaiting = snapshot.nextTickets.length > 0;

  return (
    <div className="relative flex min-h-screen w-full flex-col justify-between overflow-hidden bg-slate-950 text-slate-100 select-none">
      {/* Background ambient glow */}
      <div className="pointer-events-none absolute -top-40 left-1/2 -z-10 h-96 w-[800px] -translate-x-1/2 rounded-full bg-emerald-500/10 blur-[140px]" />
      <div className="pointer-events-none absolute -bottom-40 left-1/2 -z-10 h-96 w-[600px] -translate-x-1/2 rounded-full bg-blue-500/10 blur-[140px]" />

      {/* Top Header Bar */}
      <header className="flex flex-wrap items-center justify-between border-b border-slate-800/80 bg-slate-950/80 px-6 py-4 backdrop-blur-md sm:px-10">
        <div className="flex items-center gap-4">
          {snapshot.logoUrl ? (
            <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-xl border border-slate-700/80 bg-slate-900 shadow-md">
              <img
                src={snapshot.logoUrl}
                alt={`${snapshot.businessName} logo`}
                className="max-h-full max-w-full object-contain p-1"
              />
            </div>
          ) : (
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 text-slate-950 font-black shadow-lg shadow-emerald-500/20 text-lg">
              SQ
            </div>
          )}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {snapshot.brandingText || snapshot.businessName}
            </p>
            <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">
              {snapshot.displayTitle || snapshot.queueName}
            </h1>
          </div>
        </div>

        {/* Header Right: Clock, Live Status & Controls */}
        <div className="flex items-center gap-3 sm:gap-6">
          <div className="hidden items-center gap-2 font-mono text-sm tracking-wider text-slate-400 md:flex">
            <Clock className="h-4 w-4 text-slate-500" />
            <span>{currentTime}</span>
          </div>

          <div className="rounded-full border border-slate-800 bg-slate-900/90 px-3 py-1">
            <LiveStatus status={liveStatus} />
          </div>

          {/* Quick TV Controls */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setIsMuted(!isMuted)}
              title={isMuted ? "Unmute Sound" : "Mute Sound"}
              className="rounded-lg border border-slate-800 bg-slate-900/80 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white active:scale-95"
              aria-label={isMuted ? "Unmute Sound" : "Mute Sound"}
            >
              {isMuted ? (
                <VolumeX className="h-4 w-4 text-rose-400" />
              ) : (
                <Volume2 className="h-4 w-4 text-emerald-400" />
              )}
            </button>

            <button
              type="button"
              onClick={toggleFullscreen}
              title={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
              className="rounded-lg border border-slate-800 bg-slate-900/80 p-2 text-slate-300 transition hover:bg-slate-800 hover:text-white active:scale-95"
              aria-label={isFullscreen ? "Exit Fullscreen" : "Enter Fullscreen"}
            >
              {isFullscreen ? (
                <Minimize2 className="h-4 w-4 text-slate-300" />
              ) : (
                <Maximize2 className="h-4 w-4 text-slate-300" />
              )}
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex flex-1 flex-col items-center justify-center px-4 py-8 sm:px-10">
        <div className="w-full max-w-5xl">
          {activeTicket ? (
            /* ACTIVE TICKET HERO CARD */
            <div
              className={`relative mx-auto flex flex-col items-center justify-center rounded-3xl border p-8 text-center shadow-2xl transition-all duration-500 sm:p-14 ${
                isNewCallAnimating
                  ? "scale-[1.02] border-amber-400/90 bg-gradient-to-b from-amber-950/40 to-slate-900/90 shadow-amber-500/20 ring-4 ring-amber-400/40"
                  : isCalled
                    ? "border-amber-500/60 bg-gradient-to-b from-amber-950/20 to-slate-900/90 shadow-amber-500/10"
                    : "border-emerald-500/50 bg-gradient-to-b from-emerald-950/20 to-slate-900/90 shadow-emerald-500/10"
              }`}
            >
              {/* Badge: NOW CALLED or NOW SERVING */}
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border px-5 py-1.5 text-sm font-bold uppercase tracking-widest sm:text-base">
                {isCalled ? (
                  <span className="flex items-center gap-2 text-amber-400">
                    <Sparkles className="h-4 w-4 animate-spin text-amber-400" />
                    NOW CALLED — PLEASE PROCEED
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-emerald-400">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    NOW SERVING
                  </span>
                )}
              </div>

              {/* Giant Ticket Number */}
              <div
                className={`font-mono text-7xl font-black tracking-tight transition-transform duration-300 sm:text-8xl md:text-9xl ${
                  isNewCallAnimating
                    ? "text-amber-300 animate-bounce"
                    : isCalled
                      ? "text-amber-400"
                      : "text-emerald-400"
                }`}
              >
                {activeTicket}
              </div>

              {/* Instruction message */}
              <p className="mt-4 text-base font-medium text-slate-300 sm:text-lg">
                {isCalled
                  ? "Please proceed to the service counter immediately"
                  : "Currently being attended at the counter"}
              </p>

              {/* Both called and serving secondary display if both exist */}
              {snapshot.currentlyCalled && snapshot.currentlyServing && (
                <div className="mt-6 flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-950/60 px-5 py-2.5 text-xs text-slate-400 sm:text-sm">
                  <span>Now Serving:</span>
                  <span className="font-mono font-bold text-slate-200">
                    {snapshot.currentlyServing}
                  </span>
                </div>
              )}
            </div>
          ) : (
            /* EMPTY HERO STATE (No active ticket) */
            <div className="mx-auto flex max-w-xl flex-col items-center justify-center rounded-3xl border border-slate-800/80 bg-slate-900/40 p-10 text-center shadow-xl backdrop-blur">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-slate-800 bg-slate-900 text-slate-400">
                <Users className="h-8 w-8 text-slate-500" />
              </div>
              <h2 className="mt-4 text-2xl font-bold tracking-tight text-white">
                {hasWaiting ? "Waiting for Next Customer" : "Queue is Currently Clear"}
              </h2>
              <p className="mt-2 text-sm text-slate-400">
                {hasWaiting
                  ? "The next ticket number will be called to the counter shortly."
                  : "No customers are waiting in line. Join the queue using the QR code below."}
              </p>
            </div>
          )}

          {/* NEXT IN LINE SECTION */}
          <div className="mt-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400">
                  Next in Line
                </h3>
                {snapshot.showWaitingCount !== false ? (
                  <span className="rounded-full bg-slate-800 px-2 py-0.5 text-xs font-semibold text-slate-300">
                    {snapshot.totalWaiting} waiting
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-slate-500">Please be ready when called</p>
            </div>

            {hasWaiting ? (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-6">
                {snapshot.nextTickets.map((ticketNumber, idx) => (
                  <div
                    key={ticketNumber}
                    className={`flex flex-col items-center justify-center rounded-2xl border p-4 shadow-sm transition-all ${
                      idx === 0
                        ? "border-blue-500/50 bg-blue-950/30 text-blue-100 ring-1 ring-blue-500/30"
                        : "border-slate-800 bg-slate-900/60 text-slate-200"
                    }`}
                  >
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      {idx === 0 ? "Next" : `#${idx + 1} in line`}
                    </span>
                    <span className="mt-1 font-mono text-2xl font-extrabold tracking-tight sm:text-3xl">
                      {ticketNumber}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-xl border border-slate-800/60 bg-slate-900/30 py-6 text-center text-sm text-slate-500">
                No tickets waiting in line
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Bottom Footer Bar */}
      <footer className="flex flex-wrap items-center justify-between border-t border-slate-800/80 bg-slate-950/80 px-6 py-4 backdrop-blur-md sm:px-10">
        <div className="flex items-center gap-3">
          <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
          <p className="text-xs font-medium text-slate-400 sm:text-sm">
            Please watch this screen for your ticket number
          </p>
        </div>

        {/* Join QR Card */}
        {snapshot.showQrCode !== false && joinQrDataUrl ? (
          <div className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900/90 px-3 py-2 shadow-sm">
            <img
              src={joinQrDataUrl}
              alt="Scan to join queue"
              className="h-10 w-10 rounded-md bg-white p-0.5"
            />
            <div className="text-left">
              <p className="text-xs font-bold text-white flex items-center gap-1">
                <QrCode className="h-3 w-3 text-emerald-400" />
                Scan to Join
              </p>
              <p className="text-[11px] text-slate-400">Open camera on your phone</p>
            </div>
          </div>
        ) : snapshot.brandingText ? (
          <div className="text-xs text-slate-400 font-medium">
            {snapshot.brandingText}
          </div>
        ) : (
          <div className="text-xs text-slate-500 font-mono">
            {joinUrl}
          </div>
        )}
      </footer>
    </div>
  );
}
