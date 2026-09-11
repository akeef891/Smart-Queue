/**
 * Audio and haptic feedback utilities for queue notifications.
 * Uses native Web Audio API (no external MP3/WAV files required) and navigator.vibrate.
 */

export function playNotificationSound(type: "called" | "alert"): void {
  if (typeof window === "undefined") return;

  try {
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;

    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    if (type === "called") {
      // 3-tone ascending chime: C5 -> E5 -> G5
      const notes = [523.25, 659.25, 783.99];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.15);

        gain.gain.setValueAtTime(0.18, now + i * 0.15);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.15 + 0.35);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.15);
        osc.stop(now + i * 0.15 + 0.35);
      });
    } else {
      // 2-tone gentle ping: E5 -> A5
      const notes = [659.25, 880];
      notes.forEach((freq, i) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, now + i * 0.12);

        gain.gain.setValueAtTime(0.12, now + i * 0.12);
        gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.28);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(now + i * 0.12);
        osc.stop(now + i * 0.12 + 0.28);
      });
    }
  } catch {
    // Audio context may be blocked by user interaction policies or unsupported
  }
}

export function triggerHapticFeedback(type: "called" | "alert"): void {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;

  try {
    if (type === "called") {
      // Strong double buzz for turn call
      navigator.vibrate([250, 100, 250]);
    } else {
      // Subtle single tap
      navigator.vibrate(150);
    }
  } catch {
    // Vibration API ignored or blocked
  }
}
