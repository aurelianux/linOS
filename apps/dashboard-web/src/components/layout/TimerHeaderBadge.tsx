import { useEffect, useRef, useState } from "react";
import { mdiAlarm, mdiTimer } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { useTimerSocket } from "@/hooks/useTimerSocket";
import { cn } from "@/lib/utils";

const ONE_MINUTE_MS = 60_000;

/** Format remaining milliseconds as MM:SS */
function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/**
 * Compact timer badge for the header bar.
 * Shows countdown (MM:SS) when running, pulsing alert when alerting, hidden when idle.
 */
export function TimerHeaderBadge() {
  const { state } = useTimerSocket();
  const [remainingMs, setRemainingMs] = useState(0);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef(state);

  const isRunning = state?.running === true;
  const isAlerting = state?.alerting === true;

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    if (!isRunning) return;

    function tick() {
      const s = stateRef.current;
      if (!s?.running || s.startedAt === null) return;
      const elapsed = Date.now() - s.startedAt;
      setRemainingMs(Math.max(0, s.durationMs - elapsed));
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isRunning]);

  // Hide when idle
  if (!isRunning && !isAlerting) return null;

  const textColor = isAlerting
    ? "text-red-400"
    : remainingMs > ONE_MINUTE_MS
      ? "text-emerald-400"
      : remainingMs > ONE_MINUTE_MS / 2
        ? "text-amber-400"
        : "text-red-400";

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 border bg-slate-800 text-xs px-2 py-0.5 rounded",
        isAlerting
          ? "border-red-400/50 animate-pulse"
          : "border-slate-700"
      )}
    >
      <Icon
        path={isAlerting ? mdiAlarm : mdiTimer}
        size={0.55}
        className={textColor}
      />
      <span className={cn("font-semibold font-mono tabular-nums", textColor)}>
        {isAlerting ? "00:00" : formatTime(remainingMs)}
      </span>
    </div>
  );
}
