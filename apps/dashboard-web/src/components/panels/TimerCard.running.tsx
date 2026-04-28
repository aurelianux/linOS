import { useEffect, useRef, useState } from "react";
import { mdiAlarm, mdiStop } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import type { TimerState } from "@/hooks/useTimerSocket";
import {
  RING_SIZE, RING_STROKE, RING_RADIUS, RING_CIRCUMFERENCE,
  formatTime, getRemainingMs, getRingColor,
} from "./TimerCard.helpers";

export function useTimerCountdown(state: TimerState | null, isRunning: boolean) {
  const [remainingMs, setRemainingMs] = useState(0);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const stateRef = useRef(state);
  useEffect(() => { stateRef.current = state; }, [state]);

  useEffect(() => {
    if (!isRunning) return;
    function tick() {
      const s = stateRef.current;
      if (!s?.running || s.startedAt === null) return;
      const remaining = getRemainingMs(s.startedAt, s.durationMs);
      setRemainingMs(remaining);
      setProgress(s.durationMs > 0 ? remaining / s.durationMs : 0);
      rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current !== null) { cancelAnimationFrame(rafRef.current); rafRef.current = null; } };
  }, [isRunning]);

  return { remainingMs, progress };
}

export function AlertView({ label, onStop }: { label?: string; onStop: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-2">
      <div className="w-20 h-20 rounded-full flex items-center justify-center bg-red-400/20 animate-pulse">
        <Icon path={mdiAlarm} size={2} className="text-red-400" />
      </div>
      <p className="text-lg font-semibold text-red-400">Time&apos;s up!</p>
      {label && <p className="text-sm text-slate-400 truncate max-w-full">{label}</p>}
      <button type="button" onClick={onStop} className="flex items-center gap-2 px-6 py-3 rounded-lg bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors">
        <Icon path={mdiStop} size={0.8} />
        <span className="text-sm font-medium">Dismiss</span>
      </button>
    </div>
  );
}

export function RunningView({ label, remainingMs, progress, onStop }: { label?: string; remainingMs: number; progress: number; onStop: () => void }) {
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);
  const ringColor = getRingColor(remainingMs);

  return (
    <div className="flex flex-col items-center gap-4">
      {label && <p className="text-sm text-slate-400 truncate max-w-full">{label}</p>}
      <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
        <svg width={RING_SIZE} height={RING_SIZE} className="transform -rotate-90">
          <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} fill="none" stroke="currentColor" strokeWidth={RING_STROKE} className="text-slate-800" />
          <circle cx={RING_SIZE / 2} cy={RING_SIZE / 2} r={RING_RADIUS} fill="none" stroke="currentColor" strokeWidth={RING_STROKE} strokeLinecap="round" strokeDasharray={RING_CIRCUMFERENCE} strokeDashoffset={strokeDashoffset} className={cn("transition-colors duration-500", ringColor)} />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-3xl font-mono font-semibold text-slate-100 tabular-nums">{formatTime(remainingMs)}</span>
        </div>
      </div>
      <button type="button" onClick={onStop} className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-400/10 text-red-400 hover:bg-red-400/20 transition-colors">
        <Icon path={mdiStop} size={0.8} />
        <span className="text-sm font-medium">Stop</span>
      </button>
    </div>
  );
}
