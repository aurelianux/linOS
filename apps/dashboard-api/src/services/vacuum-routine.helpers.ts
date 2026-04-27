import type { VacuumRoutine } from "../config/app-config.js";

export type ExecutionState =
  | "idle"
  | "scheduled"
  | "running"
  | "paused"
  | "error"
  | "completed";

export interface ExecutionContext {
  routine: VacuumRoutine;
  stepIndex: number;
  startedAt: number;
  pausedAt: number | null;
  scheduledAt: number | null;
  errorMessage: string | null;
}

/** Delay between setting fan/water modes and starting the clean (ms) */
export const SETTINGS_APPLY_DELAY_MS = 500;
/** Interval between vacuum state polls (ms) */
export const STATE_POLL_INTERVAL_MS = 10_000;
/** Delay between consecutive steps (ms) */
export const INTER_STEP_DELAY_MS = 5_000;

export function resolveSegmentIds(
  roomToSegmentId: Map<string, number>,
  roomIds: string[]
): number[] {
  return roomIds.reduce<number[]>((acc, roomId) => {
    const segId = roomToSegmentId.get(roomId);
    if (segId !== undefined) acc.push(segId);
    return acc;
  }, []);
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export interface VacuumRoutineState {
  executionState: ExecutionState;
  currentRoutineId: string | null;
  currentStepIndex: number;
  totalSteps: number;
  scheduledAt: number | null;
  startedAt: number | null;
  pausedAt: number | null;
  errorMessage: string | null;
}

export function deriveRoutineState(context: ExecutionContext | null): VacuumRoutineState {
  if (!context) {
    return {
      executionState: "idle",
      currentRoutineId: null,
      currentStepIndex: 0,
      totalSteps: 0,
      scheduledAt: null,
      startedAt: null,
      pausedAt: null,
      errorMessage: null,
    };
  }

  const executionState: ExecutionState =
    context.errorMessage !== null
      ? "error"
      : context.pausedAt !== null
        ? "paused"
        : context.scheduledAt !== null && context.scheduledAt > Date.now()
          ? "scheduled"
          : "running";

  return {
    executionState,
    currentRoutineId: context.routine.id,
    currentStepIndex: context.stepIndex,
    totalSteps: context.routine.steps.length,
    scheduledAt: context.scheduledAt,
    startedAt: context.startedAt,
    pausedAt: context.pausedAt,
    errorMessage: context.errorMessage,
  };
}
