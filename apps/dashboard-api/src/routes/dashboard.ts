import { Router, type Request, type Response } from "express";
import type { DashboardConfig } from "../config/app-config.js";
import type { ApiResponse } from "../middleware/errors.js";

/**
 * Serves the dashboard entity configuration (quick actions + rooms with scenes).
 * Config is loaded from config/dashboard.json at startup and served as-is.
 */
export function dashboardRouter(config: DashboardConfig): Router {
  const router = Router();

  router.get(
    "/dashboard/config",
    (_req: Request, res: Response): void => {
      const response: ApiResponse<DashboardConfig> = { ok: true, data: config };
      res.json(response);
    }
  );

  return router;
}
