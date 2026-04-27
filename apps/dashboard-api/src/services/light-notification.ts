import type pino from "pino";
import {
  type Session,
  DEFAULT_BRIGHTNESS,
  DEFAULT_ON_MS,
  DEFAULT_OFF_MS,
  callLightService,
  applySessionColor,
  executeLightBlink,
} from "./light-notification.helpers.js";

/** RGB color tuple */
export type RGB = [number, number, number];

/** Options for starting a light notification session */
export interface LightSessionOptions {
  entityIds: string[];
  pattern: "solid" | "blink";
  color: RGB;
  brightness?: number;
  onMs?: number;
  offMs?: number;
  durationMs?: number;
}

/**
 * Centralized service for controlling HA lights as notification feedback.
 * Session-based: each consumer calls start() and gets a session ID.
 */
export class LightNotificationService {
  private sessions = new Map<string, Session>();
  private nextSessionId = 1;

  constructor(
    private readonly logger: pino.Logger,
    private readonly haUrl: string,
    private readonly haToken: string
  ) {}

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
      abortController: new AbortController(),
    };
    this.sessions.set(sessionId, session);
    this.logger.info({ sessionId, pattern: options.pattern, entityIds: options.entityIds }, "Light session started");

    if (options.durationMs !== undefined && options.durationMs > 0) {
      session.expiryTimeout = setTimeout(() => {
        this.stop(sessionId).catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.error({ sessionId, err: msg }, "Auto-expiry stop failed");
        });
      }, options.durationMs);
    }

    if (options.pattern === "solid") {
      applySessionColor(session, this.haUrl, this.haToken, this.logger);
    } else {
      executeLightBlink(sessionId, this.sessions, this.haUrl, this.haToken, this.logger).catch(() => {});
    }
    return sessionId;
  }

  updateColor(sessionId: string, color: RGB, brightness?: number): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.options.color = color;
    if (brightness !== undefined) session.options.brightness = brightness;
    if (session.options.pattern === "solid") {
      applySessionColor(session, this.haUrl, this.haToken, this.logger);
    }
  }

  async stop(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.abortController.abort();
    if (session.blinkTimeout !== null) { clearTimeout(session.blinkTimeout); session.blinkTimeout = null; }
    if (session.expiryTimeout !== null) { clearTimeout(session.expiryTimeout); session.expiryTimeout = null; }
    this.sessions.delete(sessionId);
    await callLightService(this.haUrl, this.haToken, session.options.entityIds, "turn_off", undefined, undefined, this.logger);
    this.logger.info({ sessionId }, "Light session stopped");
  }

  async stopAll(): Promise<void> {
    const ids = [...this.sessions.keys()];
    for (const id of ids) await this.stop(id);
  }

  isActive(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }
}
