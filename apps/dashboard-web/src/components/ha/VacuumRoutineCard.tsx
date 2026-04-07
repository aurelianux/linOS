import { useState, useCallback, useMemo } from "react";
import { useVacuumRoutineSocket } from "@/hooks/useVacuumRoutineSocket";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useVacuumRoutineStore } from "@/stores/useVacuumRoutineStore";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import {
  mdiPlay,
  mdiPause,
  mdiStop,
  mdiStar,
  mdiStarOutline,
  mdiRobotVacuum,
  mdiClock,
} from "@mdi/js";
import { cn } from "@/lib/utils";
import type { VacuumRoutine } from "@/lib/api/types";

interface VacuumRoutineCardProps {
  routine: VacuumRoutine;
}

const SCHEDULE_PRESETS = [
  { label: "Now", delayMs: 0 },
  { label: "+10m", delayMs: 10 * 60 * 1000 },
  { label: "+30m", delayMs: 30 * 60 * 1000 },
  { label: "+1h", delayMs: 60 * 60 * 1000 },
  { label: "+2h", delayMs: 2 * 60 * 60 * 1000 },
];

export function VacuumRoutineCard({ routine }: VacuumRoutineCardProps) {
  const { state, start, pause, resume, cancel } = useVacuumRoutineSocket();
  const { data: dashConfig } = useDashboardConfig();
  const isFavorite = useVacuumRoutineStore((s) => s.isFavorite);
  const toggleFavorite = useVacuumRoutineStore((s) => s.toggleFavorite);

  const [expanded, setExpanded] = useState(false);
  const [customHours, setCustomHours] = useState(0);
  const [customMinutes, setCustomMinutes] = useState(0);

  const isCurrentRoutine = state?.currentRoutineId === routine.id;
  const executionState = isCurrentRoutine ? state?.executionState : "idle";
  const isIdle = executionState === "idle";
  const isRunning = executionState === "running";
  const isPaused = executionState === "paused";
  const isScheduled = executionState === "scheduled";
  const isError = executionState === "error";

  const rooms = useMemo(() => dashConfig?.rooms ?? [], [dashConfig?.rooms]);

  const currentStep =
    isCurrentRoutine && state?.currentStepIndex !== undefined
      ? routine.steps[state.currentStepIndex] ?? null
      : null;

  const currentStepRoomNames = useMemo(() => {
    if (!currentStep) return "";
    return currentStep.segments
      .map((roomId) => rooms.find((r) => r.id === roomId)?.name ?? roomId)
      .join(", ");
  }, [currentStep, rooms]);

  const handleStart = useCallback(
    async (delayMs?: number) => {
      try {
        await start(routine.id, delayMs);
        setExpanded(false);
      } catch (err: unknown) {
        console.error("Failed to start routine:", err);
      }
    },
    [start, routine.id]
  );

  const handleCustomStart = useCallback(async () => {
    const totalMs = customHours * 60 * 60 * 1000 + customMinutes * 60 * 1000;
    await handleStart(totalMs > 0 ? totalMs : undefined);
    setCustomHours(0);
    setCustomMinutes(0);
  }, [customHours, customMinutes, handleStart]);

  const handlePause = useCallback(async () => {
    try {
      await pause();
    } catch (err: unknown) {
      console.error("Failed to pause routine:", err);
    }
  }, [pause]);

  const handleResume = useCallback(async () => {
    try {
      await resume();
    } catch (err: unknown) {
      console.error("Failed to resume routine:", err);
    }
  }, [resume]);

  const handleCancel = useCallback(async () => {
    try {
      await cancel();
    } catch (err: unknown) {
      console.error("Failed to cancel routine:", err);
    }
  }, [cancel]);

  const stateBadgeVariant: "default" | "secondary" | "success" | "warning" | "destructive" =
    isError
      ? "destructive"
      : isRunning
        ? "success"
        : isPaused
          ? "warning"
          : isScheduled
            ? "default"
            : "secondary";

  const stateLabel = isError
    ? "Error"
    : isRunning
      ? `Step ${(state?.currentStepIndex ?? 0) + 1}/${state?.totalSteps}`
      : isPaused
        ? "Paused"
        : isScheduled
          ? "Scheduled"
          : "Ready";

  // ─── Expanded view ───────────────────────────────────────────────────────────

  if (expanded) {
    return (
      <Card className="col-span-full">
        <CardContent className="p-4 space-y-4">
          <div className="flex items-center gap-2">
            <Icon path={mdiRobotVacuum} size={1} className="text-slate-400" />
            <div className="flex-1 min-w-0">
              <h3 className="font-semibold text-slate-100">{routine.label}</h3>
              {routine.description && (
                <p className="text-sm text-slate-400">{routine.description}</p>
              )}
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setExpanded(false)}
            >
              ✕
            </Button>
          </div>

          {isCurrentRoutine && currentStep && (
            <div className="space-y-1 p-2 bg-slate-800/50 rounded">
              <p className="text-xs text-slate-400">
                Step {(state?.currentStepIndex ?? 0) + 1}/{state?.totalSteps}
              </p>
              <p className="text-sm text-slate-200">
                {currentStep.mode === "vacuum_and_mop" ? "Vacuum & Mop" : "Vacuum"} —{" "}
                {currentStepRoomNames}
              </p>
            </div>
          )}

          {/* Schedule section — only shown when idle */}
          {isIdle && (
            <div className="space-y-3 pt-2 border-t border-slate-700">
              <p className="text-xs text-slate-400 uppercase tracking-wider">
                Schedule start
              </p>

              <div className="flex flex-wrap gap-2">
                {SCHEDULE_PRESETS.map((preset) => (
                  <Button
                    key={preset.label}
                    size="sm"
                    variant={preset.delayMs === 0 ? "default" : "secondary"}
                    onClick={() => handleStart(preset.delayMs > 0 ? preset.delayMs : undefined)}
                  >
                    {preset.label}
                  </Button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  max="23"
                  value={customHours}
                  onChange={(e) => setCustomHours(Number(e.target.value))}
                  placeholder="0"
                  className="w-14 px-2 py-1 bg-slate-700 text-slate-100 rounded text-sm border border-slate-600 focus:outline-none focus:border-slate-500"
                />
                <span className="text-slate-400 text-sm">h</span>
                <input
                  type="number"
                  min="0"
                  max="59"
                  value={customMinutes}
                  onChange={(e) => setCustomMinutes(Number(e.target.value))}
                  placeholder="0"
                  className="w-14 px-2 py-1 bg-slate-700 text-slate-100 rounded text-sm border border-slate-600 focus:outline-none focus:border-slate-500"
                />
                <span className="text-slate-400 text-sm">m</span>
                <Button size="sm" variant="secondary" onClick={handleCustomStart}>
                  Schedule
                </Button>
              </div>
            </div>
          )}

          {/* Control buttons — shown when active */}
          {!isIdle && (
            <div className="flex gap-2 pt-2 border-t border-slate-700">
              {isRunning && (
                <Button
                  size="sm"
                  variant="secondary"
                  className="text-amber-400 hover:text-amber-300"
                  onClick={handlePause}
                >
                  <Icon path={mdiPause} size={0.8} />
                  Pause
                </Button>
              )}
              {isPaused && (
                <>
                  <Button size="sm" variant="default" onClick={handleResume}>
                    <Icon path={mdiPlay} size={0.8} />
                    Resume
                  </Button>
                  <Button size="sm" variant="destructive" onClick={handleCancel}>
                    <Icon path={mdiStop} size={0.8} />
                    Cancel
                  </Button>
                </>
              )}
              {isScheduled && (
                <Button size="sm" variant="destructive" onClick={handleCancel}>
                  <Icon path={mdiStop} size={0.8} />
                  Cancel Schedule
                </Button>
              )}
            </div>
          )}

          {/* Step overview */}
          <div className="pt-2 border-t border-slate-700 space-y-1">
            <p className="text-xs text-slate-400 uppercase tracking-wider">Steps</p>
            {routine.steps.map((step, i) => {
              const isDone =
                isCurrentRoutine && (state?.currentStepIndex ?? 0) > i;
              const isCurrent =
                isCurrentRoutine && state?.currentStepIndex === i;
              const stepRooms = step.segments
                .map((roomId) => rooms.find((r) => r.id === roomId)?.name ?? roomId)
                .join(", ");
              return (
                <div
                  key={i}
                  className={cn(
                    "text-sm flex items-center gap-2 py-1",
                    isDone && "text-slate-500 line-through",
                    isCurrent && "text-emerald-400 font-medium",
                    !isDone && !isCurrent && "text-slate-300"
                  )}
                >
                  <span className="text-slate-500 w-4 text-xs">{i + 1}.</span>
                  {step.mode === "vacuum_and_mop" ? "Vacuum & Mop" : "Vacuum"} — {stepRooms}
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    );
  }

  // ─── Compact view ────────────────────────────────────────────────────────────

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={() => setExpanded(true)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setExpanded(true);
        }
      }}
      className={cn(
        "cursor-pointer select-none transition-colors duration-200",
        "h-20 relative overflow-hidden",
        isRunning && "bg-emerald-400/5 border-emerald-900/50",
        isPaused && "bg-amber-400/5 border-amber-900/50",
        isScheduled && "bg-sky-400/5 border-sky-900/50",
        isError && "bg-red-400/5 border-red-900/50"
      )}
    >
      {!isIdle && (
        <div
          className={cn(
            "absolute inset-x-0 bottom-0 h-full bg-gradient-to-t to-transparent rounded-lg",
            isRunning && "from-emerald-400/10",
            isPaused && "from-amber-400/10",
            isScheduled && "from-sky-400/10",
            isError && "from-red-400/10"
          )}
        />
      )}

      <div className="relative z-10 h-full flex flex-col justify-between p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-slate-100 truncate text-sm">
              {routine.label}
            </h3>
            {currentStepRoomNames && isCurrentRoutine && (
              <p className="text-xs text-slate-400 truncate">{currentStepRoomNames}</p>
            )}
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              toggleFavorite(routine.id);
            }}
            className="flex-shrink-0 text-slate-500 hover:text-amber-400 transition-colors"
            title={isFavorite(routine.id) ? "Remove favorite" : "Add favorite"}
          >
            <Icon
              path={isFavorite(routine.id) ? mdiStar : mdiStarOutline}
              size={0.7}
            />
          </button>
        </div>

        <div className="flex items-end justify-between gap-2">
          <Badge variant={stateBadgeVariant} className="text-xs">
            {stateLabel}
          </Badge>

          {isRunning && (
            <Icon
              path={mdiRobotVacuum}
              size={0.7}
              className="text-emerald-400 animate-pulse"
            />
          )}
          {(isPaused || isScheduled) && (
            <Icon path={mdiClock} size={0.7} className="text-amber-400" />
          )}
        </div>
      </div>
    </Card>
  );
}
