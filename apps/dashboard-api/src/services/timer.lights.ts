import type pino from "pino";
import type { LightNotificationService } from "./light-notification.js";
import type { RGB } from "./light-notification.js";

export const LIGHT_BRIGHTNESS = 255;
const LIGHT_UPDATE_INTERVAL_MS = 10_000;
const BLINK_ON_MS = 500;
const BLINK_OFF_MS = 500;
const LAST_MINUTE_MS = 60_000;
const START_INDICATOR_BLINK_MS = 1_000;

function progressToColor(remainingMs: number, durationMs: number): RGB {
  const transitionWindow = Math.min(LAST_MINUTE_MS, durationMs);
  if (remainingMs > transitionWindow) return [0, 255, 0];
  const p = Math.max(0, Math.min(1, remainingMs / transitionWindow));
  if (p > 0.5) {
    const t = (p - 0.5) / 0.5;
    return [Math.round(255 * (1 - t)), 255, 0];
  }
  const t = p / 0.5;
  return [255, Math.round(255 * t), 0];
}

export class TimerLightFeedback {
  private solidSessionId: string | null = null;
  private blinkSessionId: string | null = null;
  private lightUpdateInterval: ReturnType<typeof setInterval> | null = null;
  private startIndicatorTimeout: ReturnType<typeof setTimeout> | null = null;
  private lastMinuteTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(
    private readonly lightNotification: LightNotificationService,
    private readonly entityIds: string[],
    private readonly logger: pino.Logger
  ) {}

  startIndicatorBlink(durationMs: number): void {
    if (!this.entityIds.length) return;
    this.solidSessionId = this.lightNotification.start({
      entityIds: this.entityIds,
      pattern: "solid",
      color: [0, 255, 0],
      brightness: LIGHT_BRIGHTNESS,
      durationMs: START_INDICATOR_BLINK_MS,
    });
    this.startIndicatorTimeout = setTimeout(() => {
      this.solidSessionId = null;
      this.startIndicatorTimeout = null;
    }, START_INDICATOR_BLINK_MS);

    const transitionWindow = Math.min(LAST_MINUTE_MS, durationMs);
    const delayUntilLastMinute = durationMs - transitionWindow;
    const lastMinuteDelay = delayUntilLastMinute <= START_INDICATOR_BLINK_MS
      ? START_INDICATOR_BLINK_MS
      : delayUntilLastMinute;

    this.lastMinuteTimeout = setTimeout(() => {
      this.lastMinuteTimeout = null;
    }, lastMinuteDelay);
  }

  startLastMinuteSession(startedAt: number, durationMs: number): void {
    if (!this.entityIds.length) return;
    const elapsed = Date.now() - startedAt;
    const remainingMs = Math.max(0, durationMs - elapsed);
    const color = progressToColor(remainingMs, durationMs);
    this.solidSessionId = this.lightNotification.start({
      entityIds: this.entityIds,
      pattern: "solid",
      color,
      brightness: LIGHT_BRIGHTNESS,
    });
    this.logger.info("Last-minute light feedback started");
    this.lightUpdateInterval = setInterval(() => {
      this.updateLightColor(startedAt, durationMs);
    }, LIGHT_UPDATE_INTERVAL_MS);
  }

  updateLightColor(startedAt: number, durationMs: number): void {
    if (!this.solidSessionId) return;
    const elapsed = Date.now() - startedAt;
    const remainingMs = Math.max(0, durationMs - elapsed);
    const color = progressToColor(remainingMs, durationMs);
    this.lightNotification.updateColor(this.solidSessionId, color, LIGHT_BRIGHTNESS);
  }

  startBlink(): void {
    if (!this.entityIds.length) return;
    this.blinkSessionId = this.lightNotification.start({
      entityIds: this.entityIds,
      pattern: "blink",
      color: [255, 0, 0],
      brightness: LIGHT_BRIGHTNESS,
      onMs: BLINK_ON_MS,
      offMs: BLINK_OFF_MS,
    });
  }

  stopSolid(): void {
    if (this.solidSessionId) {
      this.lightNotification.stop(this.solidSessionId).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error({ err: msg }, "Failed to stop solid light session");
      });
      this.solidSessionId = null;
    }
  }

  stopBlink(): void {
    if (this.blinkSessionId) {
      this.lightNotification.stop(this.blinkSessionId).catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error({ err: msg }, "Failed to stop blink light session");
      });
      this.blinkSessionId = null;
    }
  }

  stopAll(): void {
    this.stopSolid();
    this.stopBlink();
  }

  clearTimers(): void {
    if (this.lightUpdateInterval) { clearInterval(this.lightUpdateInterval); this.lightUpdateInterval = null; }
    if (this.startIndicatorTimeout) { clearTimeout(this.startIndicatorTimeout); this.startIndicatorTimeout = null; }
    if (this.lastMinuteTimeout) { clearTimeout(this.lastMinuteTimeout); this.lastMinuteTimeout = null; }
  }
}
