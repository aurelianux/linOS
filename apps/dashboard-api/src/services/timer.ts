import type pino from "pino";

/**
 * Timer state — single in-memory timer (lost on restart, intentional).
 */
export interface TimerState {
  running: boolean;
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

/** HA light config for progress feedback */
interface TimerLightConfig {
  haUrl: string;
  haToken: string;
  lightEntities: string[];
}

/** RGB color tuple */
type RGB = [number, number, number];

const LIGHT_UPDATE_INTERVAL_MS = 10_000;
const BLINK_COUNT = 3;
const BLINK_DELAY_MS = 500;
const LIGHT_BRIGHTNESS = 255;

/**
 * Interpolate timer progress (1 → 0) to color:
 *   100% → green, 50% → yellow, 10% → red
 */
function progressToColor(progress: number): RGB {
  // Clamp
  const p = Math.max(0, Math.min(1, progress));

  if (p > 0.5) {
    // Green → Yellow  (1.0 → 0.5)
    const t = (p - 0.5) / 0.5;
    return [Math.round(255 * (1 - t)), 255, 0];
  }
  // Yellow → Red  (0.5 → 0.0)
  const t = p / 0.5;
  return [255, Math.round(255 * t), 0];
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export class TimerService {
  private state: TimerState = {
    running: false,
    startedAt: null,
    durationMs: 0,
    label: "",
  };

  private listeners: TimerChangeListener[] = [];
  private completionTimeout: ReturnType<typeof setTimeout> | null = null;
  private lightInterval: ReturnType<typeof setInterval> | null = null;
  private lightConfig: TimerLightConfig | null = null;

  constructor(private readonly logger: pino.Logger) {}

  /** Configure HA light entities for progress feedback (optional) */
  configureLights(config: TimerLightConfig): void {
    this.lightConfig = config;
    this.logger.info(
      { entities: config.lightEntities },
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
    // Stop any running timer first
    this.clearTimers();

    this.state = {
      running: true,
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
    if (this.lightConfig && this.lightConfig.lightEntities.length > 0) {
      this.updateLights();
      this.lightInterval = setInterval(() => {
        this.updateLights();
      }, LIGHT_UPDATE_INTERVAL_MS);
    }

    this.notify();
    return this.getState();
  }

  stop(): TimerState {
    if (!this.state.running) {
      return this.getState();
    }

    this.clearTimers();

    this.state = {
      running: false,
      startedAt: null,
      durationMs: 0,
      label: "",
    };

    this.logger.info("Timer stopped");
    this.notify();
    return this.getState();
  }

  private complete(): void {
    this.clearTimers();

    const label = this.state.label;

    this.state = {
      running: false,
      startedAt: null,
      durationMs: 0,
      label: "",
    };

    this.logger.info({ label }, "Timer completed");
    this.notify();

    // Blink lights on completion
    if (this.lightConfig && this.lightConfig.lightEntities.length > 0) {
      this.blinkLights().catch((err: unknown) => {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.error({ err: msg }, "Failed to blink lights on timer completion");
      });
    }
  }

  private clearTimers(): void {
    if (this.completionTimeout) {
      clearTimeout(this.completionTimeout);
      this.completionTimeout = null;
    }
    if (this.lightInterval) {
      clearInterval(this.lightInterval);
      this.lightInterval = null;
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

  private getProgress(): number {
    if (!this.state.running || this.state.startedAt === null || this.state.durationMs === 0) {
      return 0;
    }
    const elapsed = Date.now() - this.state.startedAt;
    return Math.max(0, 1 - elapsed / this.state.durationMs);
  }

  // ───────────────────────────────────────────────
  // Home Assistant light integration
  // ───────────────────────────────────────────────

  private async callHaService(
    entityId: string,
    service: "turn_on" | "turn_off",
    data?: Record<string, unknown>
  ): Promise<void> {
    if (!this.lightConfig) return;

    const url = `${this.lightConfig.haUrl}/api/services/light/${service}`;
    const body = { entity_id: entityId, ...data };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.lightConfig.haToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        this.logger.warn(
          { entityId, service, status: response.status },
          "HA light service call failed"
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn({ entityId, service, err: msg }, "HA light service call error");
    }
  }

  private updateLights(): void {
    if (!this.lightConfig || !this.state.running) return;

    const progress = this.getProgress();
    const color = progressToColor(progress);

    for (const entityId of this.lightConfig.lightEntities) {
      this.callHaService(entityId, "turn_on", {
        rgb_color: color,
        brightness: LIGHT_BRIGHTNESS,
      }).catch(() => {
        // Errors already logged in callHaService
      });
    }
  }

  private async blinkLights(): Promise<void> {
    if (!this.lightConfig) return;

    for (let i = 0; i < BLINK_COUNT; i++) {
      for (const entityId of this.lightConfig.lightEntities) {
        await this.callHaService(entityId, "turn_on", {
          rgb_color: [255, 0, 0] satisfies RGB,
          brightness: LIGHT_BRIGHTNESS,
        });
      }
      await sleep(BLINK_DELAY_MS);

      for (const entityId of this.lightConfig.lightEntities) {
        await this.callHaService(entityId, "turn_off");
      }
      await sleep(BLINK_DELAY_MS);
    }
  }
}
