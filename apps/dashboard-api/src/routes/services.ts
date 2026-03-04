import net from "net";
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
 * Probe a single service by TCP socket connect.
 * Resolves "ok" if connection succeeds within timeout, "error" otherwise.
 */
async function probeTcp(
  id: string,
  label: string,
  category: string,
  host: string,
  port: number
): Promise<ServiceStatus> {
  const start = Date.now();
  return new Promise<ServiceStatus>((resolve) => {
    const socket = new net.Socket();
    let settled = false;

    const finish = (status: "ok" | "error") => {
      if (settled) return;
      settled = true;
      if (!socket.destroyed) socket.destroy();
      resolve({
        id,
        label,
        category,
        status,
        latencyMs: status === "ok" ? Date.now() - start : null,
      });
    };

    socket.setTimeout(PROBE_TIMEOUT_MS);
    socket.connect(port, host, () => finish("ok"));
    socket.on("error", () => finish("error"));
    socket.on("timeout", () => finish("error"));
  });
}

/**
 * Probe a single service by sending a GET to its healthUrl.
 * Any HTTP response with status < 400 is considered "ok" (service reachable).
 * Timeouts and connection errors map to "error".
 * Services without a healthUrl are returned with status "unknown".
 */
async function probeService(entry: ServiceEntry): Promise<ServiceStatus> {
  // TCP health check for non-HTTP services
  if (entry.healthType === "tcp") {
    if (!entry.healthHost || !entry.healthPort) {
      console.warn(
        `⚠️  TCP health check for "${entry.id}" is missing healthHost or healthPort — skipping probe`
      );
      return {
        id: entry.id,
        label: entry.label,
        category: entry.category,
        status: "unknown",
        latencyMs: null,
      };
    }
    return probeTcp(
      entry.id,
      entry.label,
      entry.category,
      entry.healthHost,
      entry.healthPort
    );
  }

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
