import type pino from "pino";
import type { LightNotificationService, RGB } from "./light-notification.js";

/**
 * Timer state — single in-memory timer (lost on restart, intentional).
 */
export interface TimerState {
  running: boolean;
  alerting: boolean;
  startedAt: number | null;
  durationMs: number;
  label: string;
}

/** Payload for starting a timer */
export interface TimerStartInput {
  durationMs: number;
  label?: string | undefined;
}

/** Callback invoked on every timer state change */
type TimerChangeListener = (state: TimerState) => void;

const LIGHT_UPDATE_INTERVAL_MS = 10_000;
const BLINK_ON_MS = 500;
const BLINK_OFF_MS = 500;
const LIGHT_BRIGHTNESS = 255;
const LAST_MINUTE_MS = 60_000;

/**
 * Color progression for timer lights:
 *   - Before last 60s: solid green
 *   - Last 60s: green → yellow → red (compressed)
 *   - If total duration < 60s, entire duration is the transition window
 */
function progressToColor(remainingMs: number, durationMs: number): RGB {
  const transitionWindow = Math.min(LAST_MINUTE_MS, durationMs);

  if (remainingMs > transitionWindow) {
    return [0, 255, 0];
  }

  // p goes from 1.0 (start of transition) to 0.0 (timer end)
  const p = Math.max(0, Math.min(1, remainingMs / transitionWindow));

  if (p > 0.5) {
    // Green → Yellow (1.0 → 0.5)
    const t = (p - 0.5) / 0.5;
    return [Math.round(255 * (1 - t)), 255, 0];
  }
  // Yellow → Red (0.5 → 0.0)
  const t = p / 0.5;
  return [255, Math.round(255 * t), 0];
}

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
  private lightUpdateInterval: ReturnType<typeof setInterval> | null = null;

  /** Light notification session IDs */
  private solidSessionId: string | null = null;
  private blinkSessionId: string | null = null;

  private lightNotification: LightNotificationService | null = null;
  private lightEntityIds: string[] = [];

  constructor(private readonly logger: pino.Logger) {}

  /**
   * Configure HA light entities for progress feedback (optional).
   * If not called, the timer works normally without light feedback.
   */
  configureLights(
    lightNotification: LightNotificationService,
    entityIds: string[]
  ): void {
    this.lightNotification = lightNotification;
    this.lightEntityIds = entityIds;
    this.logger.info(
      { entities: entityIds },
      "Timer light feedback configured"
    );
  }

  /** Subscribe to state changes (for WebSocket broadcast) */
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
    // Stop any running timer or alert first
    this.clearTimers();
    this.stopLightSessions();

    this.state = {
      running: true,
      alerting: false,
      startedAt: Date.now(),
      durationMs: input.durationMs,
      label: input.label ?? "",
    };

    this.logger.info(
      { durationMs: input.durationMs, label: this.state.label },
      "Timer started"
    );

    // Schedule completion
    this.completionTimeout = setTimeout(() => {
      this.complete();
    }, input.durationMs);

    // Start light updates if configured
    if (this.lightNotification && this.lightEntityIds.length > 0) {
      this.startSolidSession();
      this.lightUpdateInterval = setInterval(() => {
        this.updateLightColor();
      }, LIGHT_UPDATE_INTERVAL_MS);
    }

    this.notify();
    return this.getState();
  }

  stop(): TimerState {
    if (!this.state.running && !this.state.alerting) {
      return this.getState();
    }

    this.clearTimers();
    this.stopLightSessions();

    this.state = {
      running: false,
      alerting: false,
      startedAt: null,
      durationMs: 0,
      label: "",
    };

    this.logger.info("Timer stopped");
    this.notify();
    return this.getState();
  }

  // ───────────────────────────────────────────────
  // Private: timer lifecycle
  // ───────────────────────────────────────────────

  private complete(): void {
    this.clearTimers();

    const label = this.state.label;

    // Stop the solid color session
    this.stopSolidSession();

    // Enter alerting state — keep label and duration for frontend display
    this.state = {
      running: false,
      alerting: true,
      startedAt: this.state.startedAt,
      durationMs: this.state.durationMs,
      label,
    };

    this.logger.info({ label }, "Timer completed — entering alert state");
    this.notify();

    // Start continuous blink on lights
    this.startBlinkSession();
  }

  private clearTimers(): void {
    if (this.completionTimeout) {
      clearTimeout(this.completionTimeout);
      this.completionTimeout = null;
    }
    if (this.lightUpdateInterval) {
      clearInterval(this.lightUpdateInterval);
      this.lightUpdateInterval = null;
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

  // ───────────────────────────────────────────────
  // Private: light notification integration
  // ───────────────────────────────────────────────

  private startSolidSession(): void {
    if (!this.lightNotification || this.lightEntityIds.length === 0) return;
    if (this.state.startedAt === null) return;

    const elapsed = Date.now() - this.state.startedAt;
    const remainingMs = Math.max(0, this.state.durationMs - elapsed);
    const color = progressToColor(remainingMs, this.state.durationMs);

    this.solidSessionId = this.lightNotification.start({
      entityIds: this.lightEntityIds,
      pattern: "solid",
      color,
      brightness: LIGHT_BRIGHTNESS,
    });
  }

  private updateLightColor(): void {
    if (!this.lightNotification || !this.solidSessionId) return;
    if (!this.state.running || this.state.startedAt === null) return;

    const elapsed = Date.now() - this.state.startedAt;
    const remainingMs = Math.max(0, this.state.durationMs - elapsed);
    const color = progressToColor(remainingMs, this.state.durationMs);

    this.lightNotification.updateColor(
      this.solidSessionId,
      color,
      LIGHT_BRIGHTNESS
    );
  }

  private stopSolidSession(): void {
    if (this.solidSessionId && this.lightNotification) {
      this.lightNotification.stop(this.solidSessionId).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error({ err: msg }, "Failed to stop solid light session");
      });
      this.solidSessionId = null;
    }
  }

  private startBlinkSession(): void {
    if (!this.lightNotification || this.lightEntityIds.length === 0) return;

    this.blinkSessionId = this.lightNotification.start({
      entityIds: this.lightEntityIds,
      pattern: "blink",
      color: [255, 0, 0],
      brightness: LIGHT_BRIGHTNESS,
      onMs: BLINK_ON_MS,
      offMs: BLINK_OFF_MS,
    });
  }

  private stopBlinkSession(): void {
    if (this.blinkSessionId && this.lightNotification) {
      this.lightNotification.stop(this.blinkSessionId).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error({ err: msg }, "Failed to stop blink light session");
      });
      this.blinkSessionId = null;
    }
  }

  private stopLightSessions(): void {
    this.stopSolidSession();
    this.stopBlinkSession();
  }
}
