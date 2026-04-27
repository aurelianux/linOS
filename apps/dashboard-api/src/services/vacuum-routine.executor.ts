import type pino from "pino";
import type { VacuumHaClient } from "./vacuum-ha-client.js";
import {
  type ExecutionContext,
  SETTINGS_APPLY_DELAY_MS,
  STATE_POLL_INTERVAL_MS,
  INTER_STEP_DELAY_MS,
  resolveSegmentIds,
  delay,
} from "./vacuum-routine.helpers.js";

export interface ContextAccessor {
  get(): ExecutionContext | null;
  set(ctx: ExecutionContext | null): void;
  notify(): void;
}

export class VacuumRoutineExecutor {
  private pollInterval: NodeJS.Timeout | null = null;

  constructor(
    private readonly haClient: VacuumHaClient | null,
    private readonly roomToSegmentId: Map<string, number>,
    private readonly logger: pino.Logger,
    private readonly ctx: ContextAccessor
  ) {}

  executeCurrentStep(): void {
    const context = this.ctx.get();
    if (!context) return;

    const step = context.routine.steps[context.stepIndex];
    if (!step) {
      this.logger.error("No step found at current index — completing routine");
      this.completeRoutine();
      return;
    }
    if (!this.haClient) {
      this.logger.warn("No HA client configured — routine state tracked but vacuum won't move");
      return;
    }

    const segmentIds = resolveSegmentIds(this.roomToSegmentId, step.segments);
    if (segmentIds.length === 0) {
      this.logger.error({ roomIds: step.segments }, "Could not resolve any room IDs to segment IDs — skipping step");
      this.advanceToNextStep();
      return;
    }

    const client = this.haClient;
    const routineId = context.routine.id;
    const stepIndex = context.stepIndex;
    this.logger.info({ routineId, stepIndex, segmentIds, fanPower: step.fanPower, waterBoxMode: step.waterBoxMode }, "Executing vacuum step");

    (async () => {
      try {
        await client.setFanPower(step.fanPower);
        await client.setWaterBoxMode(step.waterBoxMode);
        await delay(SETTINGS_APPLY_DELAY_MS);
        await client.startSegmentClean(segmentIds);
        this.logger.info({ routineId, stepIndex }, "Vacuum step commands sent — polling for completion");
        this.startPolling();
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error({ routineId, stepIndex, err: msg }, "Failed to execute vacuum step");
        const ctx = this.ctx.get();
        if (ctx) { ctx.errorMessage = `Step ${stepIndex + 1} failed: ${msg}`; this.ctx.notify(); }
      }
    })();
  }

  startPolling(): void {
    this.stopPolling();
    if (!this.haClient) return;
    const client = this.haClient;
    let wasCleaningObserved = false;

    this.pollInterval = setInterval(() => {
      const context = this.ctx.get();
      if (!context || context.pausedAt !== null) return;

      client.getEntityState().then((state) => {
        const ctx = this.ctx.get();
        if (!ctx || ctx.pausedAt !== null) return;
        this.logger.debug({ vacuumState: state, wasCleaningObserved }, "Vacuum state poll");

        if (state === "cleaning") wasCleaningObserved = true;

        if (wasCleaningObserved && state !== null && state !== "cleaning") {
          this.logger.info({ vacuumState: state, stepIndex: ctx.stepIndex }, "Vacuum step completed — advancing");
          this.stopPolling();
          this.advanceToNextStep();
        }
        if (state === "error") {
          this.logger.error("Vacuum reported error state — aborting routine");
          this.stopPolling();
          const c = this.ctx.get();
          if (c) { c.errorMessage = "Vacuum reported error"; this.ctx.notify(); }
        }
      }).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn({ err: msg }, "Failed to poll vacuum state");
      });
    }, STATE_POLL_INTERVAL_MS);
  }

  stopPolling(): void {
    if (this.pollInterval) { clearInterval(this.pollInterval); this.pollInterval = null; }
  }

  private advanceToNextStep(): void {
    const context = this.ctx.get();
    if (!context) return;
    context.stepIndex += 1;
    if (context.stepIndex >= context.routine.steps.length) { this.completeRoutine(); return; }
    this.logger.info({ routineId: context.routine.id, stepIndex: context.stepIndex }, "Advancing to next step");
    this.ctx.notify();
    setTimeout(() => this.executeCurrentStep(), INTER_STEP_DELAY_MS);
  }

  private completeRoutine(): void {
    const context = this.ctx.get();
    if (context) this.logger.info({ routineId: context.routine.id }, "Routine completed successfully");
    this.ctx.set(null);
    this.stopPolling();
    this.ctx.notify();
  }
}
