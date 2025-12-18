import { Router, type Request, type Response } from "express";
import { type ApiResponse } from "../middleware/errors.js";

/**
 * Health check endpoint
 * - Returns { ok: true, data: { status: "ok" } }
 * - Should be fast and not spam logs (excluded from pino-http in app.ts)
 * - Used by Caddy/monitoring for liveness probes
 */
export function healthRouter(): Router {
  const router = Router();

  router.get("/health", (_req: Request, res: Response) => {
    const response: ApiResponse = {
      ok: true,
      data: { status: "ok" },
    };

    res.json(response);
  });

  return router;
}
