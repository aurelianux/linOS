import { Router, type Request, type Response } from "express";
import type pino from "pino";
import type { Env } from "../config/env.js";
import { type ApiResponse } from "../middleware/errors.js";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GpuMetrics {
  name: string;
  utilizationPercent: number;
  memoryUsedMiB: number;
  memoryTotalMiB: number;
}

export interface BertaMetrics {
  hostname: string;
  uptimeSeconds: number;
  cpuLoadPercent: number;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  gpu: GpuMetrics | null;
}

export interface BertaData {
  available: boolean;
  metrics: BertaMetrics | null;
  unavailableReason: string | null;
}

// ─── TTL Cache ────────────────────────────────────────────────────────────────

interface CacheEntry<T> {
  value: T;
  expiresAt: number;
}

function makeCache<T>() {
  let entry: CacheEntry<T> | null = null;
  return {
    get(): T | null {
      if (!entry || Date.now() > entry.expiresAt) return null;
      return entry.value;
    },
    set(value: T, ttlMs: number): void {
      entry = { value, expiresAt: Date.now() + ttlMs };
    },
  };
}

const bertaCache = makeCache<BertaData>();
const CACHE_TTL_MS = 10_000;

// ─── Fetch helper ─────────────────────────────────────────────────────────────

interface AgentResponse {
  ok: boolean;
  data: BertaMetrics;
}

async function fetchBertaMetrics(
  bertaUrl: string,
  logger: pino.Logger
): Promise<BertaData> {
  try {
    const res = await fetch(`${bertaUrl}/metrics`, {
      signal: AbortSignal.timeout(5000),
    });

    if (!res.ok) {
      return {
        available: false,
        metrics: null,
        unavailableReason: `Berta agent responded with HTTP ${res.status}`,
      };
    }

    const json = (await res.json()) as AgentResponse;

    if (!json.ok) {
      return {
        available: false,
        metrics: null,
        unavailableReason: "Berta agent returned ok=false",
      };
    }

    return { available: true, metrics: json.data, unavailableReason: null };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.warn({ err: msg }, "Failed to fetch berta metrics");
    return {
      available: false,
      metrics: null,
      unavailableReason: `Failed to reach berta agent: ${msg}`,
    };
  }
}

// ─── Router ───────────────────────────────────────────────────────────────────

export function bertaRouter(env: Env, logger: pino.Logger): Router {
  const router = Router();

  const bertaUrl =
    env.LINOS_HOST_BERTA_IP !== undefined
      ? `http://${env.LINOS_HOST_BERTA_IP}:${env.BERTA_AGENT_PORT}`
      : null;

  router.get(
    "/system/berta",
    async (_req: Request, res: Response): Promise<void> => {
      if (bertaUrl === null) {
        res.json({
          ok: true,
          data: {
            available: false,
            metrics: null,
            unavailableReason: "LINOS_HOST_BERTA_IP is not configured",
          },
        } satisfies ApiResponse<BertaData>);
        return;
      }

      const cached = bertaCache.get();
      if (cached) {
        res.json({ ok: true, data: cached } satisfies ApiResponse<BertaData>);
        return;
      }

      const data = await fetchBertaMetrics(bertaUrl, logger);
      bertaCache.set(data, CACHE_TTL_MS);
      res.json({ ok: true, data } satisfies ApiResponse<BertaData>);
    }
  );

  return router;
}
