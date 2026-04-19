import net from "net";
import type pino from "pino";
import { type ServiceEntry } from "../config/app-config.js";

export const PROBE_TIMEOUT_MS = 3000;

export interface ServiceStatus {
  id: string;
  label: string;
  category: string;
  /** ok = 2xx/3xx response, error = connection failure or 4xx+/5xx, unknown = not probed */
  status: "ok" | "error" | "unknown";
  latencyMs: number | null;
}

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

export async function probeService(entry: ServiceEntry, logger: pino.Logger): Promise<ServiceStatus> {
  if (entry.healthType === "tcp") {
    if (!entry.healthHost || !entry.healthPort) {
      logger.warn({ id: entry.id }, "TCP health check missing healthHost or healthPort — skipping probe");
      return {
        id: entry.id,
        label: entry.label,
        category: entry.category,
        status: "unknown",
        latencyMs: null,
      };
    }
    return probeTcp(entry.id, entry.label, entry.category, entry.healthHost, entry.healthPort);
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
