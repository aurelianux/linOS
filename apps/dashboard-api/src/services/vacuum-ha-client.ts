import type pino from "pino";

/** Timeout for individual HA API calls (ms) */
const HA_CALL_TIMEOUT_MS = 5_000;

/** Water box mode value that disables mopping */
const WATER_BOX_OFF = 200;

/**
 * REST client for controlling a Roborock vacuum via Home Assistant API.
 *
 * Follows the same service call pattern used by the RoborockQuickPanel
 * on the frontend (set_custom_mode → set_water_box_custom_mode →
 * app_segment_clean), but executes from the backend so that
 * VacuumRoutineService can orchestrate multi-step routines.
 */
export class VacuumHaClient {
  constructor(
    private readonly logger: pino.Logger,
    private readonly haUrl: string,
    private readonly haToken: string,
    private readonly entityId: string
  ) {}

  // ─── Vacuum commands ────────────────────────────────────────────────────────

  /** Set suction power via send_command. Matches frontend's set_custom_mode call. */
  async setFanPower(power: number): Promise<void> {
    await this.sendCommand("set_custom_mode", [power]);
  }

  /**
   * Set water box (mop) intensity via send_command.
   * Pass null to disable mopping (sends WATER_BOX_OFF = 200).
   */
  async setWaterBoxMode(mode: number | null): Promise<void> {
    await this.sendCommand("set_water_box_custom_mode", [mode ?? WATER_BOX_OFF]);
  }

  /**
   * Start segment-based cleaning.
   * @param segmentIds Numeric Roborock segment IDs (not room string IDs)
   */
  async startSegmentClean(segmentIds: number[]): Promise<void> {
    await this.sendCommand("app_segment_clean", [{ segments: segmentIds, repeat: 1 }]);
  }

  async pause(): Promise<void> {
    await this.callService("vacuum", "pause");
  }

  /** Resume cleaning (HA uses "start" to resume a paused vacuum) */
  async resume(): Promise<void> {
    await this.callService("vacuum", "start");
  }

  async stop(): Promise<void> {
    await this.callService("vacuum", "stop");
  }

  async returnToBase(): Promise<void> {
    await this.callService("vacuum", "return_to_base");
  }

  // ─── State query ────────────────────────────────────────────────────────────

  /**
   * Fetch the current vacuum entity state from HA.
   * Returns the state string (e.g. "docked", "cleaning", "returning", "paused", "idle", "error").
   * Returns null if the request fails.
   */
  async getEntityState(): Promise<string | null> {
    const url = `${this.haUrl}/api/states/${this.entityId}`;

    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${this.haToken}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.timeout(HA_CALL_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(
          { entityId: this.entityId, status: response.status },
          "Failed to fetch vacuum state from HA"
        );
        return null;
      }

      const data = (await response.json()) as { state?: string };
      return data.state ?? null;
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        this.logger.warn({ entityId: this.entityId }, "HA state request timed out");
        return null;
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn({ entityId: this.entityId, err: msg }, "HA state request error");
      return null;
    }
  }

  // ─── Internal helpers ───────────────────────────────────────────────────────

  /** Send a Roborock-specific command via vacuum.send_command */
  private async sendCommand(command: string, params: unknown[]): Promise<void> {
    await this.callService("vacuum", "send_command", { command, params });
  }

  /**
   * Generic HA service call.
   * Mirrors LightNotificationService.callHaService but for any domain/service.
   */
  private async callService(
    domain: string,
    service: string,
    data?: Record<string, unknown>
  ): Promise<void> {
    const url = `${this.haUrl}/api/services/${domain}/${service}`;
    const body = { entity_id: this.entityId, ...data };

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.haToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(HA_CALL_TIMEOUT_MS),
      });

      if (!response.ok) {
        this.logger.warn(
          { entityId: this.entityId, domain, service, status: response.status },
          "HA vacuum service call failed"
        );
      } else {
        this.logger.debug({ domain, service, data }, "HA vacuum service call succeeded");
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") {
        this.logger.warn({ domain, service }, "HA vacuum service call timed out");
        return;
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn({ domain, service, err: msg }, "HA vacuum service call error");
    }
  }
}
