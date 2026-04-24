import type pino from "pino";
import { AppError } from "../middleware/errors.js";
import type { LightEntityState, QuickToggleConfig } from "../config/app-config.js";

const HA_CALL_TIMEOUT_MS = 5_000;

/** Current mode per room. "unknown" when no mode has been applied since startup. */
export type ModeState = Record<string, string>;

export class LightingModeService {
  private currentModes: Record<string, string> = {};
  private readonly validModes: string[];
  private readonly validRooms: string[];
  private readonly roomModeConfigs: Record<string, Record<string, Record<string, LightEntityState>>>;

  constructor(
    private readonly logger: pino.Logger,
    private readonly haUrl: string,
    private readonly haToken: string,
    quickToggles: QuickToggleConfig | undefined
  ) {
    if (!quickToggles) {
      this.validModes = [];
      this.validRooms = [];
      this.roomModeConfigs = {};
      return;
    }

    this.validModes = quickToggles.modes;
    this.validRooms = quickToggles.rooms.map((r) => r.roomId);
    this.roomModeConfigs = Object.fromEntries(
      quickToggles.rooms.map((r) => [r.roomId, r.modeConfig])
    );
  }

  getValidModes(): string[] { return this.validModes; }
  getValidRooms(): string[] { return this.validRooms; }

  getModeState(): ModeState {
    return Object.fromEntries(
      this.validRooms.map((roomId) => [roomId, this.currentModes[roomId] ?? "unknown"])
    );
  }

  async applyMode(roomId: string, mode: string): Promise<void> {
    if (!this.haUrl || !this.haToken) {
      throw new AppError(
        "HA not configured — set LINOS_HA_URL and LINOS_HA_TOKEN",
        503,
        "HA_NOT_CONFIGURED"
      );
    }

    const modeEntities = this.roomModeConfigs[roomId]?.[mode];
    if (!modeEntities || Object.keys(modeEntities).length === 0) {
      this.logger.warn({ roomId, mode }, "No entities for mode — skipping");
      return;
    }

    await this.callSceneApply(modeEntities);
    this.currentModes[roomId] = mode;
    this.logger.info({ roomId, mode }, "Lighting mode applied");
  }

  /** Apply the same mode to every configured room sequentially to avoid flooding HA. */
  async applyModeAllRooms(mode: string): Promise<void> {
    for (const roomId of this.validRooms) {
      await this.applyMode(roomId, mode);
    }
  }

  private async callSceneApply(entities: Record<string, LightEntityState>): Promise<void> {
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
