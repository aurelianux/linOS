import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { useTimerSocket } from "@/hooks/useTimerSocket";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { cn } from "@/lib/utils";
import { mdiPlay, mdiStop, mdiTimer } from "@mdi/js";
import { useCallback, useEffect, useRef, useState } from "react";

/** SVG progress ring constants */
const RING_SIZE = 160;
const RING_STROKE = 6;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** Format remaining milliseconds as MM:SS */
function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/** Calculate remaining ms from server state */
function getRemainingMs(startedAt: number, durationMs: number): number {
  const elapsed = Date.now() - startedAt;
  return Math.max(0, durationMs - elapsed);
}

export function TimerCard() {
  const { t } = useTranslation();
  const { state, start, stop } = useTimerSocket();

  // Input state
  const [inputMinutes, setInputMinutes] = useState("5");
  const [inputSeconds, setInputSeconds] = useState("0");
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  // Live countdown (updated every second via requestAnimationFrame)
  const [remainingMs, setRemainingMs] = useState(0);
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);

  const isRunning = state?.running === true;

  // Tick loop for smooth countdown
  const tick = useCallback(() => {
    if (!state?.running || state.startedAt === null) {
      setRemainingMs(0);
      setProgress(0);
      return;
    }

    const remaining = getRemainingMs(state.startedAt, state.durationMs);
    setRemainingMs(remaining);
    setProgress(state.durationMs > 0 ? remaining / state.durationMs : 0);

    rafRef.current = requestAnimationFrame(tick);
  }, [state]);

  useEffect(() => {
    if (isRunning) {
      rafRef.current = requestAnimationFrame(tick);
    } else {
      setRemainingMs(0);
      setProgress(0);
    }

    return () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [isRunning, tick]);

  const handleStart = async () => {
    setError(null);

    const minutes = parseInt(inputMinutes, 10) || 0;
    const seconds = parseInt(inputSeconds, 10) || 0;
    const durationMs = (minutes * 60 + seconds) * 1000;

    if (durationMs <= 0) {
      setError(t("timer.errorMinDuration"));
      return;
    }

    try {
      await start({ durationMs, label: label || undefined });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  };

  const handleStop = async () => {
    setError(null);
    try {
      await stop();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    }
  };

  // SVG ring offset (full → empty as progress goes 1 → 0)
  const strokeDashoffset = RING_CIRCUMFERENCE * (1 - progress);

  // Progress color: green → yellow → red
  const ringColor = progress > 0.5
    ? "text-emerald-400"
    : progress > 0.1
      ? "text-amber-400"
      : "text-red-400";

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardContent className="p-4">
        {/* Header */}
        <div className="flex items-center gap-2 mb-4">
          <Icon path={mdiTimer} size={0.9} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-200">
            {t("timer.title")}
          </span>
        </div>

        {isRunning ? (
          /* ── Running state: countdown + progress ring ── */
          <div className="flex flex-col items-center gap-4">
            {/* Label */}
            {state?.label && (
              <p className="text-sm text-slate-400 truncate max-w-full">
                {state.label}
              </p>
            )}

            {/* Progress ring with countdown */}
            <div className="relative" style={{ width: RING_SIZE, height: RING_SIZE }}>
              <svg
                width={RING_SIZE}
                height={RING_SIZE}
                className="transform -rotate-90"
              >
                {/* Background ring */}
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={RING_STROKE}
                  className="text-slate-800"
                />
                {/* Progress ring */}
                <circle
                  cx={RING_SIZE / 2}
                  cy={RING_SIZE / 2}
                  r={RING_RADIUS}
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={RING_STROKE}
                  strokeLinecap="round"
                  strokeDasharray={RING_CIRCUMFERENCE}
                  strokeDashoffset={strokeDashoffset}
                  className={cn("transition-colors duration-500", ringColor)}
                />
              </svg>

              {/* Countdown text centered in ring */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-3xl font-mono font-semibold text-slate-100 tabular-nums">
                  {formatTime(remainingMs)}
                </span>
              </div>
            </div>

            {/* Stop button */}
            <button
              type="button"
              onClick={handleStop}
              className={cn(
                "flex items-center gap-2 px-4 py-2 rounded-lg",
                "bg-red-400/10 text-red-400",
                "hover:bg-red-400/20 transition-colors"
              )}
            >
              <Icon path={mdiStop} size={0.8} />
              <span className="text-sm font-medium">{t("timer.stop")}</span>
            </button>
          </div>
        ) : (
          /* ── Idle state: input form ── */
          <div className="space-y-3">
            {/* Duration inputs */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">
                  {t("timer.minutes")}
                </label>
                <input
                  type="number"
                  min="0"
                  max="1440"
                  value={inputMinutes}
                  onChange={(e) => setInputMinutes(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg text-sm",
                    "bg-slate-800 border border-slate-700 text-slate-100",
                    "focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:border-sky-400"
                  )}
                />
              </div>
              <span className="text-slate-500 mt-5 text-lg font-mono">:</span>
              <div className="flex-1">
                <label className="block text-xs text-slate-500 mb-1">
                  {t("timer.seconds")}
                </label>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={inputSeconds}
                  onChange={(e) => setInputSeconds(e.target.value)}
                  className={cn(
                    "w-full px-3 py-2 rounded-lg text-sm",
                    "bg-slate-800 border border-slate-700 text-slate-100",
                    "focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:border-sky-400"
                  )}
                />
              </div>
            </div>

            {/* Label input */}
            <div>
              <label className="block text-xs text-slate-500 mb-1">
                {t("timer.label")}
              </label>
              <input
                type="text"
                maxLength={100}
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder={t("timer.labelPlaceholder")}
                className={cn(
                  "w-full px-3 py-2 rounded-lg text-sm",
                  "bg-slate-800 border border-slate-700 text-slate-100",
                  "placeholder:text-slate-500",
                  "focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:border-sky-400"
                )}
              />
            </div>

            {/* Error */}
            {error && (
              <p className="text-xs text-red-400">{error}</p>
            )}

            {/* Start button */}
            <button
              type="button"
              onClick={handleStart}
              className={cn(
                "w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg",
                "bg-emerald-400/10 text-emerald-400",
                "hover:bg-emerald-400/20 transition-colors"
              )}
            >
              <Icon path={mdiPlay} size={0.8} />
              <span className="text-sm font-medium">{t("timer.start")}</span>
            </button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}


// Main export
export default TimerCard;