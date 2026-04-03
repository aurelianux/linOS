import os from "os";
import http from "http";
import { execFile } from "child_process";
import { Router, type Request, type Response } from "express";
import { access, constants } from "fs/promises";
import { promisify } from "util";
import { type ApiResponse } from "../middleware/errors.js";

const execFileAsync = promisify(execFile);

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
  /** Docker Compose project name (from label), or null if not a compose container */
  project: string | null;
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

const DOCKER_SOCKET = "/var/run/docker.sock";

/**
 * Make an HTTP request to the Docker Engine API via the Unix socket.
 * Returns the parsed JSON response body.
 */
export function dockerApiRequest<T>(
  path: string,
  method: "GET" | "POST" = "GET",
  timeoutMs = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath: DOCKER_SOCKET, path, method, timeout: timeoutMs },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString();
          if (!res.statusCode || res.statusCode >= 400) {
            reject(new Error(`Docker API ${res.statusCode}: ${body}`));
            return;
          }
          // Handle 204 No Content (e.g. container restart)
          if (res.statusCode === 204 || body.length === 0) {
            resolve(undefined as T);
            return;
          }
          try {
            resolve(JSON.parse(body) as T);
          } catch {
            reject(new Error(`Failed to parse Docker API response: ${body.slice(0, 200)}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Docker API request timed out"));
    });
    req.end();
  });
}

/** Raw container shape from GET /containers/json */
interface DockerApiContainer {
  Id: string;
  Names: string[];
  Image: string;
  Status: string;
  State: string;
  Labels: Record<string, string>;
}

/**
 * Query the Docker Engine API via the Unix socket at /var/run/docker.sock.
 *
 * Uses GET /containers/json?all=true directly — no docker CLI binary needed.
 *
 * Returns available=false with an actionable message when Docker is not
 * reachable (socket not mounted / daemon not running / permission denied).
 *
 * Volume mount needed in docker-compose:
 *   /var/run/docker.sock:/var/run/docker.sock:ro
 */
async function fetchContainers(): Promise<ContainersData> {
  // Pre-check: does the socket file exist and is it readable?
  try {
    await access(DOCKER_SOCKET, constants.R_OK);
  } catch {
    return {
      available: false,
      containers: [],
      unavailableReason:
        "Docker socket not found at /var/run/docker.sock. Mount /var/run/docker.sock:/var/run/docker.sock:ro in the container.",
      unavailableCode: "SOCKET_NOT_FOUND",
    };
  }

  let rawContainers: DockerApiContainer[];

  try {
    rawContainers = await dockerApiRequest<DockerApiContainer[]>(
      "/containers/json?all=true"
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);

    let reason: string;
    let code: DockerUnavailableCode;

    if (/permission denied|EACCES/i.test(msg)) {
      reason =
        "Permission denied on Docker socket. Ensure the container's group_add matches the host Docker GID.";
      code = "PERMISSION_DENIED";
    } else if (/ECONNREFUSED|ENOENT|connect/.test(msg)) {
      reason = "Docker daemon is not running or socket is not accessible.";
      code = "DAEMON_NOT_RUNNING";
    } else if (/timed out/i.test(msg)) {
      reason = "Docker API request timed out.";
      code = "DAEMON_NOT_RUNNING";
    } else {
      reason = `Docker API error: ${msg}`;
      code = "UNKNOWN_ERROR";
    }
    return { available: false, containers: [], unavailableReason: reason, unavailableCode: code };
  }

  const containers: ContainerInfo[] = rawContainers.map((c) => ({
    id: c.Id.slice(0, 12),
    // Docker API returns names prefixed with "/" — strip it
    name: (c.Names[0] ?? "").replace(/^\//, ""),
    image: c.Image,
    status: c.Status,
    state: c.State.toLowerCase(),
    project: c.Labels["com.docker.compose.project"] ?? null,
  }));

  return { available: true, containers, unavailableReason: null, unavailableCode: null };
}

// ─── Router ────────────────────────────────────────────────────────────────

/**
 * System information router.
 *
 * GET /system/info        – Host metrics via Node.js `os` module + `df -B1 /`
 * GET /system/containers  – Docker containers via Engine API socket
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
