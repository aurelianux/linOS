import type pino from "pino";
import type { VacuumConfig, VacuumRoutine, VacuumRoutineStep, RoborockConfig } from "../config/app-config.js";
import type { VacuumHaClient } from "./vacuum-ha-client.js";
import {
  type ExecutionContext,
  type ExecutionState,
  type VacuumRoutineState,
  deriveRoutineState,
} from "./vacuum-routine.helpers.js";
import { VacuumRoutineExecutor } from "./vacuum-routine.executor.js";

export type { ExecutionState, VacuumRoutineState };

type StateChangeListener = (state: VacuumRoutineState) => void;

export class VacuumRoutineService {
  private context: ExecutionContext | null = null;
  private scheduledTimeout: NodeJS.Timeout | null = null;
  private returnToDockOnPause = true;
  private listeners: StateChangeListener[] = [];
  private executor: VacuumRoutineExecutor;

  constructor(
    private readonly logger: pino.Logger,
    vacuumConfig: VacuumConfig | undefined,
    private readonly routines: VacuumRoutine[],
    private readonly haClient: VacuumHaClient | null,
    roborockConfig: RoborockConfig | undefined
  ) {
    if (vacuumConfig) this.returnToDockOnPause = vacuumConfig.returnToDockOnPause;

    const roomToSegmentId = new Map<string, number>();
    if (roborockConfig?.segments) {
      for (const seg of roborockConfig.segments) roomToSegmentId.set(seg.roomId, seg.id);
    }
    if (roomToSegmentId.size > 0) {
      logger.info({ mapping: Object.fromEntries(roomToSegmentId) }, "Room-to-segment mapping loaded");
    }

    this.executor = new VacuumRoutineExecutor(haClient, roomToSegmentId, logger, {
      get: () => this.context,
      set: (ctx) => { this.context = ctx; },
      notify: () => this.notify(),
    });
  }

  onChange(listener: StateChangeListener): () => void {
    this.listeners.push(listener);
    return () => { this.listeners = this.listeners.filter((l) => l !== listener); };
  }

  getState(): VacuumRoutineState {
    return deriveRoutineState(this.context);
  }

  start(routineId: string, delayMs?: number): VacuumRoutineState {
    const routine = this.routines.find((r) => r.id === routineId);
    if (!routine) { this.logger.warn({ routineId }, "Routine not found"); return this.getState(); }
    return this.startRoutine(routine, delayMs);
  }

  startCustom(steps: VacuumRoutineStep[], delayMs?: number): VacuumRoutineState {
    return this.startRoutine({ id: "custom", label: "Custom", steps }, delayMs);
  }

  pause(): VacuumRoutineState {
    if (!this.context || this.context.pausedAt !== null) { this.logger.warn("No running routine to pause"); return this.getState(); }
    this.context.pausedAt = Date.now();
    this.executor.stopPolling();
    if (this.haClient) {
      const client = this.haClient;
      const returnToDock = this.returnToDockOnPause;
      (async () => {
        try { await client.pause(); if (returnToDock) await client.returnToBase(); }
        catch (err: unknown) { this.logger.error({ err: err instanceof Error ? err.message : String(err) }, "Failed to pause vacuum via HA"); }
      })();
    }
    this.logger.info({ routineId: this.context.routine.id }, "Paused routine");
    this.notify();
    return this.getState();
  }

  resume(): VacuumRoutineState {
    if (!this.context || this.context.pausedAt === null) { this.logger.warn("No paused routine to resume"); return this.getState(); }
    this.context.pausedAt = null;
    this.logger.info({ routineId: this.context.routine.id, stepIndex: this.context.stepIndex }, "Resuming routine — re-executing current step");
    this.executor.executeCurrentStep();
    this.notify();
    return this.getState();
  }

  cancel(): VacuumRoutineState {
    if (this.scheduledTimeout) { clearTimeout(this.scheduledTimeout); this.scheduledTimeout = null; }
    this.executor.stopPolling();
    if (this.context) {
      this.logger.info({ routineId: this.context.routine.id }, "Cancelled routine");
      if (this.haClient) {
        const client = this.haClient;
        (async () => {
          try { await client.stop(); await client.returnToBase(); }
          catch (err: unknown) { this.logger.error({ err: err instanceof Error ? err.message : String(err) }, "Failed to stop vacuum on cancel"); }
        })();
      }
      this.context = null;
    }
    this.notify();
    return this.getState();
  }

  getCurrentRoutine(): VacuumRoutine | null { return this.context?.routine ?? null; }
  getCurrentStep(): VacuumRoutineStep | null {
    if (!this.context) return null;
    return this.context.routine.steps[this.context.stepIndex] ?? null;
  }
  shouldReturnToDockOnPause(): boolean { return this.returnToDockOnPause; }

  private startRoutine(routine: VacuumRoutine, delayMs?: number): VacuumRoutineState {
    this.cancel();
    const scheduledAt = delayMs && delayMs > 0 ? Date.now() + delayMs : null;
    this.context = { routine, stepIndex: 0, startedAt: Date.now(), pausedAt: null, scheduledAt, errorMessage: null };
    if (scheduledAt) {
      this.logger.info({ routineId: routine.id, delayMs }, `Scheduled routine to start in ${delayMs}ms`);
      this.scheduledTimeout = setTimeout(() => {
        if (this.context) this.context.scheduledAt = null;
        this.executor.executeCurrentStep();
      }, delayMs!);
    } else {
      this.logger.info({ routineId: routine.id }, "Starting routine immediately");
      this.executor.executeCurrentStep();
    }
    this.notify();
    return this.getState();
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      try { listener(snapshot); }
      catch (err: unknown) { this.logger.error({ err: err instanceof Error ? err.message : String(err) }, "State change listener error"); }
    }
  }
}
