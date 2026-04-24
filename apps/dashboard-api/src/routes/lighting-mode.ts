import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { AppError, type ApiResponse } from "../middleware/errors.js";
import type { LightingModeService, ModeState } from "../services/lighting-mode.js";
import { MODES_CONFIG } from "../config/modes.js";

const VALID_MODES = ["hell", "chill", "aus"] as const;
const VALID_ROOMS = Object.keys(MODES_CONFIG);

const modeParamSchema = z.enum(VALID_MODES);

/**
 * Lighting mode REST endpoints
 *   GET  /mode              → current mode per room
 *   POST /mode/:mode        → apply mode to all rooms
 *   POST /mode/:mode/:room  → apply mode to a single room
 */
export function lightingModeRouter(service: LightingModeService): Router {
  const router = Router();

  router.get("/mode", (_req: Request, res: Response): void => {
    const state = service.getModeState();
    const response: ApiResponse<ModeState> = { ok: true, data: state };
    res.json(response);
  });

  router.post("/mode/:mode", async (req: Request, res: Response): Promise<void> => {
    const modeParam = Array.isArray(req.params.mode) ? req.params.mode[0] : req.params.mode;
    const parsedMode = modeParamSchema.safeParse(modeParam);
    if (!parsedMode.success) {
      throw new AppError(
        `Invalid mode "${modeParam}" — must be one of: ${VALID_MODES.join(", ")}`,
        400,
        "VALIDATION_ERROR"
      );
    }

    await service.applyModeAllRooms(parsedMode.data);
    const state = service.getModeState();
    const response: ApiResponse<ModeState> = { ok: true, data: state };
    res.json(response);
  });

  router.post("/mode/:mode/:room", async (req: Request, res: Response): Promise<void> => {
    const modeParam = Array.isArray(req.params.mode) ? req.params.mode[0] : req.params.mode;
    const parsedMode = modeParamSchema.safeParse(modeParam);
    if (!parsedMode.success) {
      throw new AppError(
        `Invalid mode "${modeParam}" — must be one of: ${VALID_MODES.join(", ")}`,
        400,
        "VALIDATION_ERROR"
      );
    }

    const roomId = Array.isArray(req.params.room) ? req.params.room[0] : req.params.room;
    if (!roomId || !VALID_ROOMS.includes(roomId)) {
      throw new AppError(
        `Invalid room "${roomId ?? ""}" — must be one of: ${VALID_ROOMS.join(", ")}`,
        400,
        "VALIDATION_ERROR"
      );
    }

    await service.applyMode(roomId, parsedMode.data);
    const state = service.getModeState();
    const response: ApiResponse<ModeState> = { ok: true, data: state };
    res.json(response);
  });

  return router;
}
