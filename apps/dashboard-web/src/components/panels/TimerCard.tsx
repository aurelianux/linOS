import { useTimerSocket } from "@/hooks/useTimerSocket";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useState } from "react";
import { useTimerCountdown, AlertView, RunningView } from "./TimerCard.running";
import { IdleView } from "./TimerCard.idle";

export function TimerCard() {
  const { t } = useTranslation();
  const { state, start, stop } = useTimerSocket();

  const [inputMinutes, setInputMinutes] = useState(5);
  const [inputSeconds, setInputSeconds] = useState(0);
  const [label, setLabel] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isRunning = state?.running === true;
  const isAlerting = state?.alerting === true;

  const { remainingMs, progress } = useTimerCountdown(state, isRunning);

  const handleStart = async () => {
    setError(null);
    const durationMs = (inputMinutes * 60 + inputSeconds) * 1000;
    if (durationMs <= 0) { setError(t("timer.errorMinDuration")); return; }
    try { await start({ durationMs, label: label || undefined }); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : String(err)); }
  };

  const handleStop = async () => {
    setError(null);
    try { await stop(); }
    catch (err: unknown) { setError(err instanceof Error ? err.message : String(err)); }
  };

  if (isAlerting) return <AlertView label={state?.label} onStop={handleStop} />;
  if (isRunning) return <RunningView label={state?.label} remainingMs={remainingMs} progress={progress} onStop={handleStop} />;

  return (
    <IdleView
      inputMinutes={inputMinutes}
      inputSeconds={inputSeconds}
      label={label}
      error={error}
      onSetMinutes={setInputMinutes}
      onSetSeconds={setInputSeconds}
      onSetLabel={setLabel}
      onStart={handleStart}
    />
  );
}

export default TimerCard;
