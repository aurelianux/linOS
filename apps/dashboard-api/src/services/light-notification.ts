import type pino from "pino";

/** RGB color tuple */
export type RGB = [number, number, number];

/** Options for starting a light notification session */
export interface LightSessionOptions {
  /** HA light entity IDs to control */
  entityIds: string[];
  /** Display pattern: solid (constant) or blink (alternating on/off) */
  pattern: "solid" | "blink";
  /** RGB color for the lights */
  color: RGB;
  /** Brightness 0-255 (default 255) */
  brightness?: number;
  /** Blink on-phase duration in ms (default 500) */
  onMs?: number;
  /** Blink off-phase duration in ms (default 500) */
  offMs?: number;
  /** Auto-expire after this many ms (optional) */
  durationMs?: number;
}

const DEFAULT_BRIGHTNESS = 255;
const DEFAULT_ON_MS = 500;
const DEFAULT_OFF_MS = 500;

/** Internal session state */
interface Session {
  options: Required<Pick<LightSessionOptions, "entityIds" | "pattern" | "color" | "brightness" | "onMs" | "offMs">>;
  /** Current blink phase: true = lights on, false = lights off */
  isOn: boolean;
  /** Handle for the next recursive setTimeout (blink) */
  blinkTimeout: ReturnType<typeof setTimeout> | null;
  /** Handle for auto-expiry timeout */
  expiryTimeout: ReturnType<typeof setTimeout> | null;
}

/**
 * Centralized service for controlling HA lights as notification feedback.
 *
 * Session-based: each consumer calls start() and gets a session ID.
 * Multiple sessions can run in parallel. Each session controls its own
 * set of entity IDs with its own pattern and color.
 *
 * Reusable by any feature (timer, washer, doorbell, …).
 */
export class LightNotificationService {
  private sessions = new Map<string, Session>();
  private nextSessionId = 1;

  constructor(
    private readonly logger: pino.Logger,
    private readonly haUrl: string,
    private readonly haToken: string
  ) {}

  /**
   * Start a new light notification session.
   * Returns a session ID that must be used for updateColor/stop.
   */
  start(options: LightSessionOptions): string {
    const sessionId = String(this.nextSessionId++);

    const session: Session = {
      options: {
        entityIds: options.entityIds,
        pattern: options.pattern,
        color: options.color,
        brightness: options.brightness ?? DEFAULT_BRIGHTNESS,
        onMs: options.onMs ?? DEFAULT_ON_MS,
        offMs: options.offMs ?? DEFAULT_OFF_MS,
      },
      isOn: false,
      blinkTimeout: null,
      expiryTimeout: null,
    };

    this.sessions.set(sessionId, session);

    this.logger.info(
      { sessionId, pattern: options.pattern, entityIds: options.entityIds },
      "Light session started"
    );

    // Auto-expiry
    if (options.durationMs !== undefined && options.durationMs > 0) {
      session.expiryTimeout = setTimeout(() => {
        this.stop(sessionId).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error({ sessionId, err: msg }, "Auto-expiry stop failed");
        });
      }, options.durationMs);
    }

    // Start the pattern
    if (options.pattern === "solid") {
      this.applyColor(session);
    } else {
      this.blinkTick(sessionId);
    }

    return sessionId;
  }

  /** Update the color of a running session */
  updateColor(sessionId: string, color: RGB, brightness?: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.options.color = color;
    if (brightness !== undefined) {
      session.options.brightness = brightness;
    }

    // For solid sessions, apply the new color immediately
    if (session.options.pattern === "solid") {
      this.applyColor(session);
    }
    // For blink sessions, the next tick will pick up the new color
  }

  /** Stop a session and turn off its lights */
  async stop(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Clear timers
    if (session.blinkTimeout !== null) {
      clearTimeout(session.blinkTimeout);
      session.blinkTimeout = null;
    }
    if (session.expiryTimeout !== null) {
      clearTimeout(session.expiryTimeout);
      session.expiryTimeout = null;
    }

    this.sessions.delete(sessionId);

    // Turn off lights
    await this.callHaService(session.options.entityIds, "turn_off");

    this.logger.info({ sessionId }, "Light session stopped");
  }

  /** Stop all active sessions */
  async stopAll(): Promise<void> {
    const ids = [...this.sessions.keys()];
    for (const id of ids) {
      await this.stop(id);
    }
  }

  /** Check if a session is still active */
  isActive(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  // ───────────────────────────────────────────────
  // Internal helpers
  // ───────────────────────────────────────────────

  /** Apply the current color to a session's entities */
  private applyColor(session: Session): void {
    this.callHaService(session.options.entityIds, "turn_on", {
      rgb_color: session.options.color,
      brightness: session.options.brightness,
    }).catch(() => {
      // Errors already logged in callHaService
    });
  }

  /**
   * Recursive blink tick — alternates on/off using setTimeout.
   * Uses recursive setTimeout (not setInterval) to avoid timing drift.
   */
  private blinkTick(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.isOn = !session.isOn;

    if (session.isOn) {
      this.callHaService(session.options.entityIds, "turn_on", {
        rgb_color: session.options.color,
        brightness: session.options.brightness,
      }).catch(() => {
        // Errors logged in callHaService
      });
    } else {
      this.callHaService(session.options.entityIds, "turn_off").catch(() => {
        // Errors logged in callHaService
      });
    }

    // Schedule next tick with the appropriate delay
    const delay = session.isOn ? session.options.onMs : session.options.offMs;
    session.blinkTimeout = setTimeout(() => {
      this.blinkTick(sessionId);
    }, delay);
  }

  /** Send a service call to HA. entity_id is sent as an array. */
  private async callHaService(
    entityIds: string[],
    service: "turn_on" | "turn_off",
    data?: Record<string, unknown>
  ): Promise<void> {
    const url = `${this.haUrl}/api/services/light/${service}`;
    const body = { entity_id: entityIds, ...data };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.haToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        this.logger.warn(
          { entityIds, service, status: response.status },
          "HA light service call failed"
        );
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(
        { entityIds, service, err: msg },
        "HA light service call error"
      );
    }
  }
}
