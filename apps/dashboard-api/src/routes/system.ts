import os from "os";
import { Router, type Request, type Response } from "express";
import { type ApiResponse } from "../middleware/errors.js";
import {
  type SystemInfo,
  type ContainersData,
  type SystemVitals,
  getDiskInfo,
  fetchContainers,
} from "./system.helpers.js";

export type {
  SystemInfo,
  ContainerInfo,
  DockerUnavailableCode,
  ContainersData,
  SystemVitals,
} from "./system.helpers.js";
export { dockerApiRequest, dockerApiRequestRaw, parseDockerLogs } from "./system.docker.js";

// ─── TTL Cache ─────────────────────────────────────────────────────────────

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

const CACHE_TTL_MS = 10_000;
const VITALS_CACHE_TTL_MS = 3_000;

const systemInfoCache = makeCache<SystemInfo>();
const containersCache = makeCache<ContainersData>();
const vitalsCache = makeCache<SystemVitals>();

// ─── Router ────────────────────────────────────────────────────────────────

export function systemRouter(): Router {
  const router = Router();

  router.get("/system/info", async (_req: Request, res: Response): Promise<void> => {
    const cached = systemInfoCache.get();
    if (cached) {
      res.json({ ok: true, data: cached } satisfies ApiResponse<SystemInfo>);
      return;
    }
    const disk = await getDiskInfo();
    const cpus = os.cpus();
    const load1 = os.loadavg()[0] ?? 0;
    const cpuLoadPercent = cpus.length > 0
      ? Math.min(100, Math.round((load1 / cpus.length) * 100))
      : 0;
    const info: SystemInfo = {
      hostname: os.hostname(),
      uptimeSeconds: Math.floor(os.uptime()),
      platform: `${os.type()} ${os.release()}`,
      arch: os.arch(),
      cpuLoadPercent,
      totalMemoryBytes: os.totalmem(),
      freeMemoryBytes: os.freemem(),
      diskTotalBytes: disk !== null ? disk.total : null,
      diskUsedBytes: disk !== null ? disk.used : null,
    };
    systemInfoCache.set(info, CACHE_TTL_MS);
    res.json({ ok: true, data: info } satisfies ApiResponse<SystemInfo>);
  });

  router.get("/system/vitals", (_req: Request, res: Response): void => {
    const cached = vitalsCache.get();
    if (cached) {
      res.json({ ok: true, data: cached } satisfies ApiResponse<SystemVitals>);
      return;
    }
    const cpus = os.cpus();
    const load1 = os.loadavg()[0] ?? 0;
    const cpuLoadPercent = cpus.length > 0
      ? Math.min(100, Math.round((load1 / cpus.length) * 100))
      : 0;
    const totalMem = os.totalmem();
    const freeMem = os.freemem();
    const memoryUsedPercent = totalMem > 0
      ? Math.round(((totalMem - freeMem) / totalMem) * 100)
      : 0;
    const vitals: SystemVitals = { cpuLoadPercent, memoryUsedPercent };
    vitalsCache.set(vitals, VITALS_CACHE_TTL_MS);
    res.json({ ok: true, data: vitals } satisfies ApiResponse<SystemVitals>);
  });

  router.get("/system/containers", async (_req: Request, res: Response): Promise<void> => {
    const cached = containersCache.get();
    if (cached) {
      res.json({ ok: true, data: cached } satisfies ApiResponse<ContainersData>);
      return;
    }
    const containersData = await fetchContainers();
    containersCache.set(containersData, CACHE_TTL_MS);
    res.json({ ok: true, data: containersData } satisfies ApiResponse<ContainersData>);
  });

  return router;
}
