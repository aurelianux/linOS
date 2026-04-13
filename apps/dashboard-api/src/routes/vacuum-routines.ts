import { Router, type Request, type Response } from "express";
import { z } from "zod";
import { AppError, type ApiResponse } from "../middleware/errors.js";
import type { VacuumRoutineService, VacuumRoutineState } from "../services/vacuum-routine.js";

const vacuumRoutineStartSchema = z.object({
  delayMs: z.number().int().nonnegative().optional(),
});

const vacuumRoutineStartCustomSchema = z.object({
  steps: z
    .array(
      z.object({
        mode: z.enum(["vacuum", "vacuum_and_mop"]),
        segments: z.array(z.string().min(1)).min(1),
        fanPower: z.number().int().nonnegative(),
        waterBoxMode: z.number().int().nonnegative().nullable(),
      })
    )
    .min(1),
  delayMs: z.number().int().nonnegative().optional(),
});

/**
 * Vacuum routine REST endpoints
 *   GET  /vacuum-routines/current       → current execution state
 *   POST /vacuum-routines/:id/start     → start a routine
 *   POST /vacuum-routines/current/pause → pause the running routine
 *   POST /vacuum-routines/current/resume → resume the paused routine
 *   POST /vacuum-routines/current/cancel → cancel the routine
 */
export function vacuumRoutinesRouter(
  service: VacuumRoutineService
): Router {
  const router = Router();

  router.get(
    "/vacuum-routines/current",
    (_req: Request, res: Response): void => {
      const state = service.getState();
      const response: ApiResponse<VacuumRoutineState> = { ok: true, data: state };
      res.json(response);
    }
  );

  router.post(
    "/vacuum-routines/:id/start",
    (req: Request, res: Response): void => {
      const id = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;

      if (!id) {
        throw new AppError(
          "Routine ID is required",
          400,
          "INVALID_REQUEST"
        );
      }

      // Treat missing/null body as empty object — "start now" sends no payload
      const parsed = vacuumRoutineStartSchema.safeParse(req.body ?? {});

      if (!parsed.success) {
        throw new AppError(
          `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
          400,
          "VALIDATION_ERROR"
        );
      }

      const delayMs = parsed.data.delayMs as number | undefined;
      const state = service.start(id, delayMs);
      const response: ApiResponse<VacuumRoutineState> = { ok: true, data: state };
      res.status(201).json(response);
    }
  );

  router.post(
    "/vacuum-routines/start-custom",
    (req: Request, res: Response): void => {
      const parsed = vacuumRoutineStartCustomSchema.safeParse(req.body);

      if (!parsed.success) {
        throw new AppError(
          `Invalid input: ${parsed.error.issues.map((i) => i.message).join(", ")}`,
          400,
          "VALIDATION_ERROR"
        );
      }

      const { steps, delayMs } = parsed.data;
      const state = service.startCustom(steps, delayMs);
      const response: ApiResponse<VacuumRoutineState> = { ok: true, data: state };
      res.status(201).json(response);
    }
  );

  router.post(
    "/vacuum-routines/current/pause",
    (_req: Request, res: Response): void => {
      const state = service.pause();
      const response: ApiResponse<VacuumRoutineState> = { ok: true, data: state };
      res.json(response);
    }
  );

  router.post(
    "/vacuum-routines/current/resume",
    (_req: Request, res: Response): void => {
      const state = service.resume();
      const response: ApiResponse<VacuumRoutineState> = { ok: true, data: state };
      res.json(response);
    }
  );

  router.post(
    "/vacuum-routines/current/cancel",
    (_req: Request, res: Response): void => {
      const state = service.cancel();
      const response: ApiResponse<VacuumRoutineState> = { ok: true, data: state };
      res.json(response);
    }
  );

  return router;
}
