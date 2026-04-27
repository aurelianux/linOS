import type pino from "pino";
import type { LightNotificationService } from "./light-notification.js";
import { TimerLightFeedback } from "./timer.lights.js";

export interface TimerState {
  running: boolean;
  alerting: boolean;
  startedAt: number | null;
  durationMs: number;
  label: string;
}

export interface TimerStartInput {
  durationMs: number;
  label?: string | undefined;
}

type TimerChangeListener = (state: TimerState) => void;

export class TimerService {
  private state: TimerState = {
    running: false,
    alerting: false,
    startedAt: null,
    durationMs: 0,
    label: "",
  };

  private listeners: TimerChangeListener[] = [];
  private completionTimeout: ReturnType<typeof setTimeout> | null = null;
  private lightFeedback: TimerLightFeedback | null = null;

  constructor(private readonly logger: pino.Logger) {}

  configureLights(lightNotification: LightNotificationService, entityIds: string[]): void {
    this.lightFeedback = new TimerLightFeedback(lightNotification, entityIds, this.logger);
    this.logger.info({ entities: entityIds }, "Timer light feedback configured");
  }

  onChange(listener: TimerChangeListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  getState(): TimerState {
    return { ...this.state };
  }

  start(input: TimerStartInput): TimerState {
    this.clearTimers();
    this.lightFeedback?.clearTimers();
    this.lightFeedback?.stopAll();

    this.state = {
      running: true,
      alerting: false,
      startedAt: Date.now(),
      durationMs: input.durationMs,
      label: input.label ?? "",
    };

    this.logger.info({ durationMs: input.durationMs, label: this.state.label }, "Timer started");

    this.completionTimeout = setTimeout(() => this.complete(), input.durationMs);
    this.lightFeedback?.startIndicatorBlink(input.durationMs);
    this.notify();
    return this.getState();
  }

  stop(): TimerState {
    if (!this.state.running && !this.state.alerting) return this.getState();
    this.clearTimers();
    this.lightFeedback?.clearTimers();
    this.lightFeedback?.stopAll();
    this.state = { running: false, alerting: false, startedAt: null, durationMs: 0, label: "" };
    this.logger.info("Timer stopped");
    this.notify();
    return this.getState();
  }

  private complete(): void {
    this.clearTimers();
    const label = this.state.label;
    this.lightFeedback?.stopSolid();
    this.state = {
      running: false,
      alerting: true,
      startedAt: this.state.startedAt,
      durationMs: this.state.durationMs,
      label,
    };
    this.logger.info({ label }, "Timer completed — entering alert state");
    this.notify();
    this.lightFeedback?.startBlink();
  }

  private clearTimers(): void {
    if (this.completionTimeout) {
      clearTimeout(this.completionTimeout);
      this.completionTimeout = null;
    }
  }

  private notify(): void {
    const snapshot = this.getState();
    for (const listener of this.listeners) {
      try {
        listener(snapshot);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error({ err: msg }, "Timer change listener error");
      }
    }
  }
}
