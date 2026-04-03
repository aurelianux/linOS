import type pino from "pino";
import type { VacuumConfig, VacuumRoutine } from "../config/app-config.js";

export type ExecutionState =
  | "idle"
  | "scheduled"
  | "running"
  | "paused"
  | "error"
  | "completed";

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

type StateChangeListener = (state: VacuumRoutineState) => void;

interface ExecutionContext {
  routine: VacuumRoutine;
  stepIndex: number;
  startedAt: number;
  pausedAt: number | null;
  scheduledAt: number | null;
}

/**
 * VacuumRoutineService manages the execution of configured vacuum cleaning routines.
 * Handles scheduling, sequential step execution, pause/resume, and state broadcasting.
 *
 * Note: HA service execution is delegated to the caller (via callback).
 * This service manages state, scheduling, and timing only.
 */
export class VacuumRoutineService {
  private context: ExecutionContext | null = null;
  private scheduledTimeout: NodeJS.Timeout | null = null;
  private stepTimeout: NodeJS.Timeout | null = null;
  private returnToDockOnPause: boolean = true;
  private listeners: StateChangeListener[] = [];
  private logger: pino.Logger;

  constructor(
    logger: pino.Logger,
    private vacuumConfig: VacuumConfig | undefined,
    private routines: VacuumRoutine[]
  ) {
    this.logger = logger;
    if (vacuumConfig) {
      this.returnToDockOnPause = vacuumConfig.returnToDockOnPause;
    }
  }

  /**
   * Subscribe to state changes for WebSocket broadcast
   */
  onChange(listener: StateChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  /**
   * Get the current execution state
   */
  getState(): VacuumRoutineState {
    if (!this.context) {
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

    return {
      executionState:
        this.context.pausedAt !== null
          ? "paused"
          : this.context.scheduledAt !== null && this.context.scheduledAt > Date.now()
            ? "scheduled"
            : "running",
      currentRoutineId: this.context.routine.id,
      currentStepIndex: this.context.stepIndex,
      totalSteps: this.context.routine.steps.length,
      scheduledAt: this.context.scheduledAt,
      startedAt: this.context.startedAt,
      pausedAt: this.context.pausedAt,
      errorMessage: null,
    };
  }

  /**
   * Start a routine immediately or at a scheduled time
   * @param routineId The routine ID to start
   * @param delayMs Optional delay in milliseconds before starting
   */
  start(routineId: string, delayMs?: number): VacuumRoutineState {
    // Find the routine
    const routine = this.routines.find((r) => r.id === routineId);
    if (!routine) {
      this.logger.warn({ routineId }, "Routine not found");
      return this.getState();
    }

    // Cancel existing routine if any
    this.cancel();

    const now = Date.now();
    const scheduledAt = delayMs && delayMs > 0 ? now + delayMs : null;

    this.context = {
      routine,
      stepIndex: 0,
      startedAt: now,
      pausedAt: null,
      scheduledAt,
    };

    if (scheduledAt) {
      this.logger.info(
        { routineId, delayMs },
        `Scheduled routine ${routineId} to start in ${delayMs}ms`
      );
      this.scheduledTimeout = setTimeout(() => {
        this.notify();
      }, delayMs!);
    } else {
      this.logger.info({ routineId }, `Started routine ${routineId}`);
    }

    this.notify();
    return this.getState();
  }

  /**
   * Pause the currently running routine
   */
  pause(): VacuumRoutineState {
    if (!this.context) {
      this.logger.warn("No routine running; pause request ignored");
      return this.getState();
    }

    this.context.pausedAt = Date.now();

    // Clear step timeout to prevent step auto-advance
    if (this.stepTimeout) {
      clearTimeout(this.stepTimeout);
      this.stepTimeout = null;
    }

    this.logger.info(
      { routineId: this.context.routine.id },
      "Paused routine"
    );

    this.notify();
    return this.getState();
  }

  /**
   * Resume the paused routine
   */
  resume(): VacuumRoutineState {
    if (!this.context || this.context.pausedAt === null) {
      this.logger.warn("No paused routine; resume request ignored");
      return this.getState();
    }

    this.context.pausedAt = null;

    this.logger.info(
      { routineId: this.context.routine.id },
      "Resumed routine"
    );

    this.notify();
    return this.getState();
  }

  /**
   * Cancel the current routine
   */
  cancel(): VacuumRoutineState {
    if (this.scheduledTimeout) {
      clearTimeout(this.scheduledTimeout);
      this.scheduledTimeout = null;
    }
    if (this.stepTimeout) {
      clearTimeout(this.stepTimeout);
      this.stepTimeout = null;
    }

    if (this.context) {
      this.logger.info(
        { routineId: this.context.routine.id },
        "Cancelled routine"
      );
      this.context = null;
    }

    this.notify();
    return this.getState();
  }

  /**
   * Move to the next step in the routine
   * Returns true if there are more steps, false if routine is complete
   */
  nextStep(): boolean {
    if (!this.context) return false;

    this.context.stepIndex += 1;

    if (this.context.stepIndex >= this.context.routine.steps.length) {
      this.logger.info(
        { routineId: this.context.routine.id },
        "Routine completed"
      );
      this.context = null;
      this.notify();
      return false;
    }

    this.logger.info(
      { routineId: this.context.routine.id, stepIndex: this.context.stepIndex },
      "Moved to next step"
    );
    this.notify();
    return true;
  }

  /**
   * Get the current routine (or null if none is running)
   */
  getCurrentRoutine(): VacuumRoutine | null {
    return this.context?.routine ?? null;
  }

  /**
   * Get the current step (or null if no routine is running)
   */
  getCurrentStep(): VacuumRoutine["steps"][number] | null {
    if (!this.context) return null;
    return this.context.routine.steps[this.context.stepIndex] ?? null;
  }

  /**
   * Whether the routine should return to dock on pause
   */
  shouldReturnToDockOnPause(): boolean {
    return this.returnToDockOnPause;
  }

  /**
   * Notify all listeners of state change
   */
  private notify(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error({ err: msg }, "State change listener error");
      }
    }
  }
}
