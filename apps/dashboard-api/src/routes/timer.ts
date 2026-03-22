import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { AppError, type ApiResponse } from "../middleware/errors.js";
import type { TimerService, TimerState } from "../services/timer.js";

const timerStartSchema = z.object({
  durationMs: z.number().int().positive().max(24 * 60 * 60 * 1000), // max 24h
  label: z.string().max(100).optional(),
});

/**
 * Timer REST endpoints
 *   GET  /timer/state  → current timer state
 *   POST /timer/start  → start a new timer
 *   POST /timer/stop   → stop the running timer
 */
export function timerRouter(timerService: TimerService): Router {
  const router = Router();

  router.get("/timer/state", (_req: Request, res: Response): void => {
    const state = timerService.getState();
    const response: ApiResponse<TimerState> = { ok: true, data: state };
    res.json(response);
  });

  router.post("/timer/start", (req: Request, res: Response): void => {
    const parsed = timerStartSchema.safeParse(req.body);

    if (!parsed.success) {
      throw new AppError(
        `Invalid timer input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
        400,
        "VALIDATION_ERROR"
      );
    }

    const state = timerService.start(parsed.data);
    const response: ApiResponse<TimerState> = { ok: true, data: state };
    res.status(201).json(response);
  });

  router.post("/timer/stop", (_req: Request, res: Response): void => {
    const state = timerService.stop();
    const response: ApiResponse<TimerState> = { ok: true, data: state };
    res.json(response);
  });

  return router;
}
