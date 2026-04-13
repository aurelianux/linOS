import type pino from "pino";
import type { VacuumConfig, VacuumRoutine, VacuumRoutineStep, RoborockConfig } from "../config/app-config.js";
import type { VacuumHaClient } from "./vacuum-ha-client.js";

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
  errorMessage: string | null;
}

/** Delay between setting fan/water modes and starting the clean (ms) */
const SETTINGS_APPLY_DELAY_MS = 500;

/**
 * Interval between vacuum state polls when waiting for a step to finish (ms).
 * The vacuum entity reports "cleaning" while active and "idle"/"docked" once done.
 */
const STATE_POLL_INTERVAL_MS = 10_000;

/** Delay between consecutive steps to let the vacuum settle (ms) */
const INTER_STEP_DELAY_MS = 5_000;

/**
 * VacuumRoutineService manages the execution of configured vacuum cleaning routines.
 *
 * Responsibilities:
 * - Scheduling (immediate or delayed start)
 * - Sequential step execution with HA service calls
 * - Polling HA vacuum state to detect step completion and auto-advance
 * - Pause/resume/cancel with proper HA commands
 * - State broadcasting via listener callbacks (consumed by WebSocket)
 *
 * The service maps room string IDs from the routine config to numeric Roborock
 * segment IDs using the roborock.segments mapping from dashboard config.
 */
export class VacuumRoutineService {
  private context: ExecutionContext | null = null;
  private scheduledTimeout: NodeJS.Timeout | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private returnToDockOnPause: boolean = true;
  private listeners: StateChangeListener[] = [];
  private logger: pino.Logger;

  /** Maps room string IDs (e.g. "flur") to numeric Roborock segment IDs (e.g. 17) */
  private roomToSegmentId: Map<string, number>;

  constructor(
    logger: pino.Logger,
    private vacuumConfig: VacuumConfig | undefined,
    private routines: VacuumRoutine[],
    private haClient: VacuumHaClient | null,
    roborockConfig: RoborockConfig | undefined
  ) {
    this.logger = logger;
    if (vacuumConfig) {
      this.returnToDockOnPause = vacuumConfig.returnToDockOnPause;
    }

    // Build the room ID → segment ID lookup from roborock config
    this.roomToSegmentId = new Map();
    if (roborockConfig?.segments) {
      for (const seg of roborockConfig.segments) {
        this.roomToSegmentId.set(seg.roomId, seg.id);
      }
    }

    if (this.roomToSegmentId.size > 0) {
      logger.info(
        { mapping: Object.fromEntries(this.roomToSegmentId) },
        "Room-to-segment mapping loaded"
      );
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

    const executionState: ExecutionState =
      this.context.errorMessage !== null
        ? "error"
        : this.context.pausedAt !== null
          ? "paused"
          : this.context.scheduledAt !== null && this.context.scheduledAt > Date.now()
            ? "scheduled"
            : "running";

    return {
      executionState,
      currentRoutineId: this.context.routine.id,
      currentStepIndex: this.context.stepIndex,
      totalSteps: this.context.routine.steps.length,
      scheduledAt: this.context.scheduledAt,
      startedAt: this.context.startedAt,
      pausedAt: this.context.pausedAt,
      errorMessage: this.context.errorMessage,
    };
  }

  /**
   * Start a routine immediately or after a delay.
   * @param routineId The routine ID to start
   * @param delayMs Optional delay in milliseconds before starting
   */
  start(routineId: string, delayMs?: number): VacuumRoutineState {
    const routine = this.routines.find((r) => r.id === routineId);
    if (!routine) {
      this.logger.warn({ routineId }, "Routine not found");
      return this.getState();
    }

    return this.startRoutine(routine, delayMs);
  }

  /**
   * Start a custom routine with ad-hoc steps (not from config).
   * Used when the frontend builds or modifies segments interactively.
   * @param steps The cleaning steps to execute
   * @param delayMs Optional delay in milliseconds before starting
   */
  startCustom(steps: VacuumRoutineStep[], delayMs?: number): VacuumRoutineState {
    const routine: VacuumRoutine = {
      id: "custom",
      label: "Custom",
      steps,
    };

    return this.startRoutine(routine, delayMs);
  }

  /**
   * Internal: start a routine (from config or custom).
   */
  private startRoutine(routine: VacuumRoutine, delayMs?: number): VacuumRoutineState {
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
      errorMessage: null,
    };

    if (scheduledAt) {
      this.logger.info(
        { routineId: routine.id, delayMs },
        `Scheduled routine to start in ${delayMs}ms`
      );
      this.scheduledTimeout = setTimeout(() => {
        // Clear scheduledAt so state transitions from "scheduled" → "running"
        if (this.context) {
          this.context.scheduledAt = null;
        }
        this.executeCurrentStep();
      }, delayMs!);
    } else {
      this.logger.info({ routineId: routine.id }, "Starting routine immediately");
      // Execute the first step asynchronously
      this.executeCurrentStep();
    }

    this.notify();
    return this.getState();
  }

  /**
   * Pause the currently running routine.
   * Sends pause command to HA and optionally returns to dock.
   */
  pause(): VacuumRoutineState {
    if (!this.context || this.context.pausedAt !== null) {
      this.logger.warn("No running routine to pause");
      return this.getState();
    }

    this.context.pausedAt = Date.now();
    this.stopPolling();

    // Send pause (and optionally return-to-dock) to HA
    if (this.haClient) {
      const client = this.haClient;
      (async () => {
        try {
          await client.pause();
          if (this.returnToDockOnPause) {
            await client.returnToBase();
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error({ err: msg }, "Failed to pause vacuum via HA");
        }
      })();
    }

    this.logger.info(
      { routineId: this.context.routine.id },
      "Paused routine"
    );

    this.notify();
    return this.getState();
  }

  /**
   * Resume the paused routine.
   * Re-executes the current step from scratch since the vacuum may have returned to dock.
   */
  resume(): VacuumRoutineState {
    if (!this.context || this.context.pausedAt === null) {
      this.logger.warn("No paused routine to resume");
      return this.getState();
    }

    this.context.pausedAt = null;

    this.logger.info(
      { routineId: this.context.routine.id, stepIndex: this.context.stepIndex },
      "Resuming routine — re-executing current step"
    );

    // Re-execute the current step (vacuum may have docked while paused)
    this.executeCurrentStep();

    this.notify();
    return this.getState();
  }

  /**
   * Cancel the current routine.
   * Stops the vacuum and returns to dock.
   */
  cancel(): VacuumRoutineState {
    this.clearTimers();

    if (this.context) {
      this.logger.info(
        { routineId: this.context.routine.id },
        "Cancelled routine"
      );

      // Stop vacuum and return to dock
      if (this.haClient) {
        const client = this.haClient;
        (async () => {
          try {
            await client.stop();
            await client.returnToBase();
          } catch (err: unknown) {
            const msg = err instanceof Error ? err.message : String(err);
            this.logger.error({ err: msg }, "Failed to stop vacuum on cancel");
          }
        })();
      }

      this.context = null;
    }

    this.notify();
    return this.getState();
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
  getCurrentStep(): VacuumRoutineStep | null {
    if (!this.context) return null;
    return this.context.routine.steps[this.context.stepIndex] ?? null;
  }

  /**
   * Whether the routine should return to dock on pause
   */
  shouldReturnToDockOnPause(): boolean {
    return this.returnToDockOnPause;
  }

  // ─── Step execution ─────────────────────────────────────────────────────────

  /**
   * Execute the current step by sending HA commands:
   * 1. Set fan power
   * 2. Set water box mode
   * 3. Wait briefly for settings to apply
   * 4. Start segment clean with mapped segment IDs
   * 5. Begin polling HA state to detect step completion
   */
  private executeCurrentStep(): void {
    if (!this.context) return;

    const step = this.context.routine.steps[this.context.stepIndex];
    if (!step) {
      this.logger.error("No step found at current index — completing routine");
      this.completeRoutine();
      return;
    }

    if (!this.haClient) {
      this.logger.warn(
        "No HA client configured — routine state tracked but vacuum won't move"
      );
      return;
    }

    const segmentIds = this.resolveSegmentIds(step.segments);
    if (segmentIds.length === 0) {
      this.logger.error(
        { roomIds: step.segments },
        "Could not resolve any room IDs to segment IDs — skipping step"
      );
      this.advanceToNextStep();
      return;
    }

    const client = this.haClient;
    const routineId = this.context.routine.id;
    const stepIndex = this.context.stepIndex;

    this.logger.info(
      { routineId, stepIndex, mode: step.mode, segmentIds, fanPower: step.fanPower, waterBoxMode: step.waterBoxMode },
      "Executing vacuum step"
    );

    (async () => {
      try {
        // 1. Set fan power
        await client.setFanPower(step.fanPower);

        // 2. Set water box mode (null → disable mopping)
        await client.setWaterBoxMode(step.waterBoxMode);

        // 3. Brief delay for the device to process settings
        await this.delay(SETTINGS_APPLY_DELAY_MS);

        // 4. Start segment clean
        await client.startSegmentClean(segmentIds);

        this.logger.info(
          { routineId, stepIndex },
          "Vacuum step commands sent — polling for completion"
        );

        // 5. Start polling HA state to detect when cleaning finishes
        this.startPolling();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error({ routineId, stepIndex, err: msg }, "Failed to execute vacuum step");

        if (this.context) {
          this.context.errorMessage = `Step ${stepIndex + 1} failed: ${msg}`;
          this.notify();
        }
      }
    })();
  }

  /**
   * Resolve room string IDs to numeric Roborock segment IDs.
   * Logs warnings for unmapped rooms but continues with the rest.
   */
  private resolveSegmentIds(roomIds: string[]): number[] {
    const segmentIds: number[] = [];

    for (const roomId of roomIds) {
      const segId = this.roomToSegmentId.get(roomId);
      if (segId !== undefined) {
        segmentIds.push(segId);
      } else {
        this.logger.warn(
          { roomId },
          "Room ID not found in roborock segment mapping — skipping"
        );
      }
    }

    return segmentIds;
  }

  // ─── State polling ──────────────────────────────────────────────────────────

  /**
   * Start polling the HA vacuum entity state.
   * When state transitions from "cleaning" to "idle"/"docked"/"returning",
   * the current step is considered complete and we advance.
   */
  private startPolling(): void {
    this.stopPolling();

    if (!this.haClient) return;

    const client = this.haClient;
    let wasCleaningObserved = false;

    this.pollInterval = setInterval(() => {
      // Skip if paused or no context
      if (!this.context || this.context.pausedAt !== null) return;

      client.getEntityState().then((state) => {
        if (!this.context || this.context.pausedAt !== null) return;

        this.logger.debug({ vacuumState: state, wasCleaningObserved }, "Vacuum state poll");

        if (state === "cleaning") {
          wasCleaningObserved = true;
        }

        // Step is complete when vacuum is no longer cleaning
        // (only after we've observed at least one "cleaning" state to avoid premature advance)
        if (wasCleaningObserved && state !== null && state !== "cleaning") {
          this.logger.info(
            { vacuumState: state, stepIndex: this.context?.stepIndex },
            "Vacuum step completed — advancing"
          );
          this.stopPolling();
          this.advanceToNextStep();
        }

        // If vacuum enters error state, abort the routine
        if (state === "error") {
          this.logger.error("Vacuum reported error state — aborting routine");
          this.stopPolling();
          if (this.context) {
            this.context.errorMessage = "Vacuum reported error";
            this.notify();
          }
        }
      }).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn({ err: msg }, "Failed to poll vacuum state");
      });
    }, STATE_POLL_INTERVAL_MS);
  }

  private stopPolling(): void {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  // ─── Step advancement ───────────────────────────────────────────────────────

  /**
   * Move to the next step. If all steps are done, complete the routine.
   * Adds a brief delay between steps to let the vacuum settle.
   */
  private advanceToNextStep(): void {
    if (!this.context) return;

    this.context.stepIndex += 1;

    if (this.context.stepIndex >= this.context.routine.steps.length) {
      this.completeRoutine();
      return;
    }

    this.logger.info(
      { routineId: this.context.routine.id, stepIndex: this.context.stepIndex },
      "Advancing to next step"
    );

    this.notify();

    // Brief delay before starting the next step
    setTimeout(() => {
      this.executeCurrentStep();
    }, INTER_STEP_DELAY_MS);
  }

  /**
   * Mark the routine as completed and reset state.
   */
  private completeRoutine(): void {
    if (this.context) {
      this.logger.info(
        { routineId: this.context.routine.id },
        "Routine completed successfully"
      );
    }
    this.context = null;
    this.clearTimers();
    this.notify();
  }

  // ─── Timer management ───────────────────────────────────────────────────────

  private clearTimers(): void {
    if (this.scheduledTimeout) {
      clearTimeout(this.scheduledTimeout);
      this.scheduledTimeout = null;
    }
    this.stopPolling();
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ─── Listener notification ──────────────────────────────────────────────────

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
