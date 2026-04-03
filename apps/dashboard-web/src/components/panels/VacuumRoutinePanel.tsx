import { useMemo } from "react";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useVacuumRoutineSocket } from "@/hooks/useVacuumRoutineSocket";
import { useVacuumRoutineStore } from "@/stores/useVacuumRoutineStore";
import { VacuumRoutineCard } from "@/components/ha/VacuumRoutineCard";
import type { VacuumRoutine } from "@/lib/api/types";

export function VacuumRoutinePanel() {
  const { t } = useTranslation();
  const { data: dashConfig } = useDashboardConfig();
  const { state } = useVacuumRoutineSocket();
  const { isExpanded } = useVacuumRoutineStore();

  // Get routines from config
  const routines = useMemo<VacuumRoutine[]>(
    () => dashConfig?.vacuum?.routines ?? [],
    [dashConfig?.vacuum?.routines]
  );

  if (!routines || routines.length === 0) {
    return null;
  }

  // Sort: favorites first, then by label
  const sortedRoutines = useMemo(() => {
    const { favoriteRoutineIds } = useVacuumRoutineStore.getState();
    return [...routines].sort((a, b) => {
      const aIsFav = favoriteRoutineIds.includes(a.id);
      const bIsFav = favoriteRoutineIds.includes(b.id);
      if (aIsFav && !bIsFav) return -1;
      if (!aIsFav && bIsFav) return 1;
      return a.label.localeCompare(b.label);
    });
  }, [routines]);

  // Auto-expand if a routine is running
  const shouldAutoExpand = state?.executionState && state.executionState !== "idle";

  return (
    <div className="space-y-3">
      {/* Routines grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {sortedRoutines.map((routine) => (
          <VacuumRoutineCard key={routine.id} routine={routine} />
        ))}
      </div>

      {/* Current execution info (if running/paused) */}
      {state?.executionState && state.executionState !== "idle" && (
        <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-slate-400">
              {state.currentRoutineId ? (
                <>
                  Routine: <span className="text-slate-200">{state.currentRoutineId}</span>
                </>
              ) : null}
            </span>
            {state.scheduledAt && state.scheduledAt > Date.now() && (
              <span className="text-slate-400">
                Starts in{" "}
                <span className="text-sky-400">
                  {Math.ceil((state.scheduledAt - Date.now()) / 1000)}s
                </span>
              </span>
            )}
          </div>
          {state.executionState === "running" && state.currentStepIndex !== undefined && (
            <div className="text-slate-300 mt-1">
              Step {state.currentStepIndex + 1} of {state.totalSteps}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
