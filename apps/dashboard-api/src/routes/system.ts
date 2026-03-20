import os from "os";
import { execFile } from "child_process";
import { promisify } from "util";
import { access, constants } from "fs/promises";
import { Router, type Request, type Response } from "express";
import { type ApiResponse } from "../middleware/errors.js";

const execFileAsync = promisify(execFile);

// ─── Exec error typing ───────────────────────────────────────────────────

/** Shape of the error thrown by promisify(execFile) — extends Error with stdio */
interface ExecError extends Error {
  stderr?: string;
  stdout?: string;
  code?: string | number | null;
}

function isExecError(err: unknown): err is ExecError {
  return err instanceof Error;
}

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

// ─── Response types ────────────────────────────────────────────────────────

export interface SystemInfo {
  hostname: string;
  uptimeSeconds: number;
  /** e.g. "Linux 5.15.0-91-generic" */
  platform: string;
  arch: string;
  /** Approximate CPU load % — 1-min load average normalized per logical CPU */
  cpuLoadPercent: number;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  diskTotalBytes: number | null;
  diskUsedBytes: number | null;
}

export interface ContainerInfo {
  id: string;
  name: string;
  image: string;
  /** Human-readable status string, e.g. "Up 2 hours" */
  status: string;
  /** Machine-readable state: "running" | "exited" | "paused" | … */
  state: string;
}

export type DockerUnavailableCode =
  | "SOCKET_NOT_FOUND"
  | "BINARY_NOT_FOUND"
  | "PERMISSION_DENIED"
  | "DAEMON_NOT_RUNNING"
  | "UNKNOWN_ERROR";

export interface ContainersData {
  available: boolean;
  containers: ContainerInfo[];
  /** Set when available is false */
  unavailableReason: string | null;
  /** Machine-readable error code for frontend conditional rendering */
  unavailableCode: DockerUnavailableCode | null;
}

export interface SystemVitals {
  cpuLoadPercent: number;
  memoryUsedPercent: number;
}

// ─── Cache instances ───────────────────────────────────────────────────────

const systemInfoCache = makeCache<SystemInfo>();
const containersCache = makeCache<ContainersData>();
const vitalsCache = makeCache<SystemVitals>();

const VITALS_CACHE_TTL_MS = 3_000;

// ─── Helpers ───────────────────────────────────────────────────────────────

/**
 * Run `df -B1 /` and return root filesystem total + used in bytes.
 * Uses -B1 (1-byte blocks) to get raw byte counts, avoiding locale-dependent
 * decimal separators and the need to multiply by 1024.
 * Returns null on any failure so callers can show "–" gracefully.
 */
async function getDiskInfo(): Promise<{ total: number; used: number } | null> {
  try {
    const { stdout } = await execFileAsync("df", ["-B1", "/"], {
      timeout: 3000,
      env: { ...process.env, LC_ALL: "C" },
    });

    // Join all lines after the header to handle long filesystem-name wrapping
    const combined = stdout.trim().split("\n").slice(1).join(" ").trim();
    const parts = combined.split(/\s+/);

    // Columns with -B1: Filesystem 1B-blocks Used Available Use% Mounted
    const totalBytes = parts[1];
    const usedBytes = parts[2];

    if (totalBytes === undefined || usedBytes === undefined) return null;

    const total = Number(totalBytes);
    const used = Number(usedBytes);

    if (Number.isNaN(total) || Number.isNaN(used)) return null;

    return { total, used };
  } catch {
    return null;
  }
}

/**
 * Run `docker ps --format '{{json .}}'` and parse running containers.
 *
 * Returns available=false with an actionable message when Docker is not
 * reachable (socket not mounted / daemon not running / binary not found).
 *
 * Volume mount needed in docker-compose:
 *   /var/run/docker.sock:/var/run/docker.sock:ro
 */
async function fetchContainers(): Promise<ContainersData> {
  // Pre-check: does the socket file exist and is it readable?
  try {
    await access("/var/run/docker.sock", constants.R_OK);
  } catch {
    return {
      available: false,
      containers: [],
      unavailableReason:
        "Docker socket not found at /var/run/docker.sock. Mount /var/run/docker.sock:/var/run/docker.sock:ro in the container.",
      unavailableCode: "SOCKET_NOT_FOUND",
    };
  }

  let stdout: string;

  try {
    const result = await execFileAsync(
      "docker",
      ["ps", "--format", "{{json .}}"],
      { timeout: 5000 }
    );
    stdout = result.stdout;
  } catch (err: unknown) {
    // Combine message + stderr for pattern matching — execFile puts
    // the actual Docker error output in stderr, not message.
    const msg = isExecError(err)
      ? `${err.message}\n${err.stderr ?? ""}`
      : String(err);

    let reason: string;
    let code: DockerUnavailableCode;

    if (msg.includes("ENOENT")) {
      reason = "Docker binary not found. Install Docker CLI or add it to PATH.";
      code = "BINARY_NOT_FOUND";
    } else if (/permission denied/i.test(msg)) {
      reason =
        "Permission denied on Docker socket. Ensure the container's group_add matches the host Docker GID.";
      code = "PERMISSION_DENIED";
    } else if (/cannot connect|is the docker daemon running/i.test(msg)) {
      reason = "Docker daemon is not running on the host.";
      code = "DAEMON_NOT_RUNNING";
    } else {
      reason = `Docker command failed: ${msg.split("\n")[0] ?? msg}`;
      code = "UNKNOWN_ERROR";
    }
    return { available: false, containers: [], unavailableReason: reason, unavailableCode: code };
  }

  const containers: ContainerInfo[] = [];

  for (const line of stdout.trim().split("\n")) {
    if (!line.trim()) continue;

    try {
      const raw = JSON.parse(line) as Record<string, unknown>;
      containers.push({
        // `docker ps --format '{{json .}}'` uses uppercase "ID" for the container ID
        id: String(raw["ID"] ?? "").slice(0, 12),
        // Names may be prefixed with "/" — strip it
        name: String(raw["Names"] ?? "").replace(/^\//, ""),
        image: String(raw["Image"] ?? ""),
        status: String(raw["Status"] ?? ""),
        state: String(raw["State"] ?? ""),
      });
    } catch {
      // Skip malformed NDJSON lines
    }
  }

  return { available: true, containers, unavailableReason: null, unavailableCode: null };
}

// ─── Router ────────────────────────────────────────────────────────────────

/**
 * System information router.
 *
 * GET /system/info        – Host metrics via Node.js `os` module + `df -B1 /`
 * GET /system/containers  – Running Docker containers via `docker ps`
 *
 * Both endpoints use a 10-second TTL cache to avoid spawning a subprocess
 * on every request when the frontend polls every 30 seconds.
 */
export function systemRouter(): Router {
  const router = Router();

  router.get(
    "/system/info",
    async (_req: Request, res: Response): Promise<void> => {
      const cached = systemInfoCache.get();
      if (cached) {
        res.json({ ok: true, data: cached } satisfies ApiResponse<SystemInfo>);
        return;
      }

      const disk = await getDiskInfo();
      const cpus = os.cpus();
      const load1 = os.loadavg()[0] ?? 0;
      const cpuLoadPercent =
        cpus.length > 0
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
    }
  );

  router.get(
    "/system/vitals",
    (_req: Request, res: Response): void => {
      const cached = vitalsCache.get();
      if (cached) {
        res.json({ ok: true, data: cached } satisfies ApiResponse<SystemVitals>);
        return;
      }

      const cpus = os.cpus();
      const load1 = os.loadavg()[0] ?? 0;
      const cpuLoadPercent =
        cpus.length > 0
          ? Math.min(100, Math.round((load1 / cpus.length) * 100))
          : 0;

      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const memoryUsedPercent =
        totalMem > 0 ? Math.round(((totalMem - freeMem) / totalMem) * 100) : 0;

      const vitals: SystemVitals = { cpuLoadPercent, memoryUsedPercent };
      vitalsCache.set(vitals, VITALS_CACHE_TTL_MS);
      res.json({ ok: true, data: vitals } satisfies ApiResponse<SystemVitals>);
    }
  );

  router.get(
    "/system/containers",
    async (_req: Request, res: Response): Promise<void> => {
      const cached = containersCache.get();
      if (cached) {
        res.json({ ok: true, data: cached } satisfies ApiResponse<ContainersData>);
        return;
      }

      const containersData = await fetchContainers();
      containersCache.set(containersData, CACHE_TTL_MS);
      res.json({ ok: true, data: containersData } satisfies ApiResponse<ContainersData>);
    }
  );

  return router;
}
