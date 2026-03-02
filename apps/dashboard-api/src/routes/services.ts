import { Router, type Request, type Response } from "express";
import { type ServiceEntry } from "../config/app-config.js";
import { type ApiResponse } from "../middleware/errors.js";

const PROBE_TIMEOUT_MS = 3000;

export interface ServiceStatus {
  id: string;
  label: string;
  category: string;
  /** ok = 2xx/3xx response, error = connection failure or 4xx+/5xx, unknown = not probed */
  status: "ok" | "error" | "unknown";
  latencyMs: number | null;
}

/**
 * Probe a single service by sending a GET to its healthUrl.
 * Any HTTP response with status < 400 is considered "ok" (service reachable).
 * Timeouts and connection errors map to "error".
 * Services without a healthUrl are returned with status "unknown".
 */
async function probeService(entry: ServiceEntry): Promise<ServiceStatus> {
  if (!entry.healthUrl) {
    return {
      id: entry.id,
      label: entry.label,
      category: entry.category,
      status: "unknown",
      latencyMs: null,
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
  const start = Date.now();

  try {
    const response = await fetch(entry.healthUrl, {
      method: "GET",
      signal: controller.signal,
    });
    clearTimeout(timeout);

    return {
      id: entry.id,
      label: entry.label,
      category: entry.category,
      status: response.status < 400 ? "ok" : "error",
      latencyMs: Date.now() - start,
    };
  } catch {
    clearTimeout(timeout);
    return {
      id: entry.id,
      label: entry.label,
      category: entry.category,
      status: "error",
      latencyMs: null,
    };
  }
}

/**
 * Services monitoring router.
 *
 * GET /services/status
 *   Probes all configured services in parallel and returns their statuses.
 *   Empty array when no services are configured.
 */
export function servicesRouter(services: ServiceEntry[]): Router {
  const router = Router();

  router.get(
    "/services/status",
    async (_req: Request, res: Response): Promise<void> => {
      const results = await Promise.allSettled(services.map(probeService));

      const statuses: ServiceStatus[] = results.map((result, i) => {
        if (result.status === "fulfilled") {
          return result.value;
        }
        // Promise itself rejected (should not happen given try/catch in probeService)
        const entry = services[i];
        return {
          id: entry?.id ?? "unknown",
          label: entry?.label ?? "Unknown",
          category: entry?.category ?? "unknown",
          status: "error" as const,
          latencyMs: null,
        };
      });

      const response: ApiResponse<ServiceStatus[]> = {
        ok: true,
        data: statuses,
      };

      res.json(response);
    }
  );

  return router;
}
