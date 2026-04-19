import { Router, type Request, type Response } from "express";
import type pino from "pino";
import { type ServiceEntry } from "../config/app-config.js";
import { type ApiResponse } from "../middleware/errors.js";
import { type ServiceStatus, probeService } from "./services.helpers.js";

export type { ServiceStatus };

/**
 * Services monitoring router.
 *
 * GET /services/status
 *   Probes all configured services in parallel and returns their statuses.
 *   Empty array when no services are configured.
 */
export function servicesRouter(services: ServiceEntry[], logger: pino.Logger): Router {
  const router = Router();

  router.get(
    "/services/status",
    async (_req: Request, res: Response): Promise<void> => {
      const results = await Promise.allSettled(services.map((e) => probeService(e, logger)));

      const statuses: ServiceStatus[] = results.map((result, i) => {
        if (result.status === "fulfilled") {
          return result.value;
        }
        const entry = services[i];
        return {
          id: entry?.id ?? "unknown",
          label: entry?.label ?? "Unknown",
          category: entry?.category ?? "unknown",
          status: "error" as const,
          latencyMs: null,
        };
      });

      const response: ApiResponse<ServiceStatus[]> = { ok: true, data: statuses };
      res.json(response);
    }
  );

  return router;
}
