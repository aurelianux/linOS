import type pino from "pino";
import {
  WATER_BOX_OFF,
  callHaService,
  fetchHaEntityState,
} from "./vacuum-ha-client.helpers.js";

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

  async setFanPower(power: number): Promise<void> {
    await this.sendCommand("set_custom_mode", [power]);
  }

  async setWaterBoxMode(mode: number | null): Promise<void> {
    await this.sendCommand("set_water_box_custom_mode", [mode ?? WATER_BOX_OFF]);
  }

  async startSegmentClean(segmentIds: number[]): Promise<void> {
    await this.sendCommand("app_segment_clean", [{ segments: segmentIds, repeat: 1 }]);
  }

  async pause(): Promise<void> {
    await callHaService(this.logger, this.haUrl, this.haToken, this.entityId, "vacuum", "pause");
  }

  async resume(): Promise<void> {
    await callHaService(this.logger, this.haUrl, this.haToken, this.entityId, "vacuum", "start");
  }

  async stop(): Promise<void> {
    await callHaService(this.logger, this.haUrl, this.haToken, this.entityId, "vacuum", "stop");
  }

  async returnToBase(): Promise<void> {
    await callHaService(this.logger, this.haUrl, this.haToken, this.entityId, "vacuum", "return_to_base");
  }

  async getEntityState(): Promise<string | null> {
    return fetchHaEntityState(this.logger, this.haUrl, this.haToken, this.entityId);
  }

  private async sendCommand(command: string, params: unknown[]): Promise<void> {
    await callHaService(this.logger, this.haUrl, this.haToken, this.entityId, "vacuum", "send_command", { command, params });
  }
}
