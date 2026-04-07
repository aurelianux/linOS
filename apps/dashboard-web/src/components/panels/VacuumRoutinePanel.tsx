import { useEffect, useMemo, useState } from "react";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useVacuumRoutineSocket } from "@/hooks/useVacuumRoutineSocket";
import { useVacuumRoutineStore } from "@/stores/useVacuumRoutineStore";
import { VacuumRoutineCard } from "@/components/ha/VacuumRoutineCard";
import type { VacuumRoutine } from "@/lib/api/types";

export function VacuumRoutinePanel() {
  const { data: dashConfig } = useDashboardConfig();
  const { state } = useVacuumRoutineSocket();
  const favoriteRoutineIds = useVacuumRoutineStore((s) => s.favoriteRoutineIds);
  const [nowMs, setNowMs] = useState(0);

  const routines = useMemo<VacuumRoutine[]>(
    () => dashConfig?.vacuum?.routines ?? [],
    [dashConfig?.vacuum?.routines]
  );

  const sortedRoutines = useMemo(
    () =>
      [...routines].sort((a, b) => {
        const aIsFav = favoriteRoutineIds.includes(a.id);
        const bIsFav = favoriteRoutineIds.includes(b.id);
        if (aIsFav && !bIsFav) return -1;
        if (!aIsFav && bIsFav) return 1;
        return a.label.localeCompare(b.label);
      }),
    [routines, favoriteRoutineIds]
  );

  const isActiveState =
    !!state?.executionState && state.executionState !== "idle";

  const routineLabel =
    state?.currentRoutineId
      ? routines.find((r) => r.id === state.currentRoutineId)?.label ??
        state.currentRoutineId
      : null;

  const scheduledAt = state?.scheduledAt;

  useEffect(() => {
    if (!scheduledAt) return;
    const updateNow = () => setNowMs(Date.now());
    updateNow();
    const id = setInterval(updateNow, 1000);
    return () => clearInterval(id);
  }, [scheduledAt]);

  const remainingSeconds =
    scheduledAt && scheduledAt > nowMs
      ? Math.ceil((scheduledAt - nowMs) / 1000)
      : 0;

  if (routines.length === 0) {
    return null;
  }

  return (
    <div className="space-y-3">
      {/* Routines grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sortedRoutines.map((routine) => (
          <VacuumRoutineCard key={routine.id} routine={routine} />
        ))}
      </div>

      {/* Current execution info (if running/scheduled/paused) */}
      {isActiveState && (
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">
              {routineLabel ? (
                <>
                  Routine:{" "}
                  <span className="text-slate-200">{routineLabel}</span>
                </>
              ) : null}
            </span>
            {remainingSeconds > 0 && (
              <span className="text-slate-400">
                Starts in{" "}
                <span className="text-sky-400">
                  {remainingSeconds}s
                </span>
              </span>
            )}
          </div>
          {state?.executionState === "running" &&
            state.currentStepIndex !== undefined && (
              <div className="text-slate-300 mt-1">
                Step {state.currentStepIndex + 1} of {state.totalSteps}
              </div>
            )}
        </div>
      )}
    </div>
  );
}
