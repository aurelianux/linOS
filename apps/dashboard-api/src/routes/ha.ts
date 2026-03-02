import { Router, type Request, type Response, type NextFunction } from "express";
import type { ApiResponse } from "../middleware/errors.js";
import type { HomeAssistantService } from "../services/home-assistant.js";

/**
 * Home Assistant proxy routes
 * All routes require a configured HomeAssistantService instance
 */
export function haRouter(ha: HomeAssistantService): Router {
  const router = Router();

  /**
   * GET /ha/states
   * Returns all HA entity states
   */
  router.get(
    "/ha/states",
    async (_req: Request, res: Response, next: NextFunction) => {
      try {
        const states = await ha.getStates();
        const response: ApiResponse = { ok: true, data: states };
        res.json(response);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * GET /ha/states/:entityId
   * Returns a single entity state by entity_id
   */
  router.get(
    "/ha/states/:entityId",
    async (
      req: Request<{ entityId: string }>,
      res: Response,
      next: NextFunction
    ) => {
      try {
        const state = await ha.getState(req.params.entityId);
        const response: ApiResponse = { ok: true, data: state };
        res.json(response);
      } catch (err) {
        next(err);
      }
    }
  );

  /**
   * POST /ha/services/:domain/:service
   * Call a Home Assistant service, e.g., light.turn_on or switch.toggle
   * Body is forwarded as service data (e.g., { entity_id: "light.living_room" })
   */
  router.post(
    "/ha/services/:domain/:service",
    async (
      req: Request<{ domain: string; service: string }>,
      res: Response,
      next: NextFunction
    ) => {
      try {
        await ha.callService(
          req.params.domain,
          req.params.service,
          (req.body as Record<string, unknown>) ?? {}
        );
        const response: ApiResponse = { ok: true, data: null };
        res.json(response);
      } catch (err) {
        next(err);
      }
    }
  );

  return router;
}
