import { Router, type Request, type Response } from "express";
import { AppError, type ApiResponse } from "../middleware/errors.js";
import type { LightingModeService, ModeState } from "../services/lighting-mode.js";

/**
 * Lighting mode REST endpoints
 *   GET  /mode              → current mode per room
 *   POST /mode/:mode        → apply mode to all rooms
 *   POST /mode/:mode/:room  → apply mode to a single room
 *
 * Valid modes and rooms are derived from the quickToggles config in dashboard.json,
 * not hardcoded here.
 */
export function lightingModeRouter(service: LightingModeService): Router {
  const router = Router();
  const validModes = service.getValidModes();
  const validRooms = service.getValidRooms();

  router.get("/mode", (_req: Request, res: Response): void => {
    const response: ApiResponse<ModeState> = { ok: true, data: service.getModeState() };
    res.json(response);
  });

  router.post("/mode/:mode", async (req: Request, res: Response): Promise<void> => {
    const mode = Array.isArray(req.params.mode) ? req.params.mode[0] : req.params.mode;
    if (!mode || !validModes.includes(mode)) {
      throw new AppError(
        `Invalid mode "${mode ?? ""}" — must be one of: ${validModes.join(", ")}`,
        400,
        "VALIDATION_ERROR"
      );
    }

    await service.applyModeAllRooms(mode);
    const response: ApiResponse<ModeState> = { ok: true, data: service.getModeState() };
    res.json(response);
  });

  router.post("/mode/:mode/:room", async (req: Request, res: Response): Promise<void> => {
    const mode = Array.isArray(req.params.mode) ? req.params.mode[0] : req.params.mode;
    if (!mode || !validModes.includes(mode)) {
      throw new AppError(
        `Invalid mode "${mode ?? ""}" — must be one of: ${validModes.join(", ")}`,
        400,
        "VALIDATION_ERROR"
      );
    }

    const roomId = Array.isArray(req.params.room) ? req.params.room[0] : req.params.room;
    if (!roomId || !validRooms.includes(roomId)) {
      throw new AppError(
        `Invalid room "${roomId ?? ""}" — must be one of: ${validRooms.join(", ")}`,
        400,
        "VALIDATION_ERROR"
      );
    }

    await service.applyMode(roomId, mode);
    const response: ApiResponse<ModeState> = { ok: true, data: service.getModeState() };
    res.json(response);
  });

  return router;
}
