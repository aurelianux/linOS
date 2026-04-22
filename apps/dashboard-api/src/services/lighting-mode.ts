import type pino from "pino";
import { AppError } from "../middleware/errors.js";
import type { ModesConfig } from "../config/modes.js";

const HA_CALL_TIMEOUT_MS = 5_000;

/** Current mode per room. "unknown" when no mode has been applied since startup. */
export type ModeState = Record<string, string>;

export class LightingModeService {
  private currentModes: Record<string, string> = {};

  constructor(
    private readonly logger: pino.Logger,
    private readonly haUrl: string,
    private readonly haToken: string,
    private readonly config: ModesConfig
  ) {}

  getModeState(): ModeState {
    const state: ModeState = {};
    for (const roomId of Object.keys(this.config)) {
      state[roomId] = this.currentModes[roomId] ?? "unknown";
    }
    return state;
  }

  async applyMode(roomId: string, mode: string): Promise<void> {
    if (!this.haUrl || !this.haToken) {
      throw new AppError(
        "HA not configured — set LINOS_HA_URL and LINOS_HA_TOKEN",
        503,
        "HA_NOT_CONFIGURED"
      );
    }

    const roomConfig = this.config[roomId];
    if (!roomConfig) {
      this.logger.warn({ roomId, mode }, "Room not found in modes config — skipping");
      return;
    }

    const modeEntities = roomConfig[mode as keyof typeof roomConfig];
    if (!modeEntities || Object.keys(modeEntities).length === 0) {
      this.logger.warn({ roomId, mode }, "No entities for mode — skipping");
      return;
    }

    await this.callSceneApply(modeEntities);
    this.currentModes[roomId] = mode;
    this.logger.info({ roomId, mode }, "Lighting mode applied");
  }

  /**
   * Apply the same mode to every room defined in the config.
   * Rooms are applied sequentially so HA is not flooded.
   */
  async applyModeAllRooms(mode: string): Promise<void> {
    for (const roomId of Object.keys(this.config)) {
      await this.applyMode(roomId, mode);
    }
  }

  private async callSceneApply(
    entities: Record<string, { state: string; brightness?: number; color_temp?: number }>
  ): Promise<void> {
    const url = `${this.haUrl}/api/services/scene/apply`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.haToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ entities }),
      signal: AbortSignal.timeout(HA_CALL_TIMEOUT_MS),
    });

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      throw new AppError(
        `HA scene.apply failed (${response.status})${body ? `: ${body}` : ""}`,
        502,
        "HA_ERROR"
      );
    }
  }
}
