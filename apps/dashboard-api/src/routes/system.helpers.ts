import { execFile } from "child_process";
import { access, constants } from "fs/promises";
import { promisify } from "util";
import { dockerApiRequest, DOCKER_SOCKET } from "./system.docker.js";

const execFileAsync = promisify(execFile);

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

/**
 * Run `df -B1 /` and return root filesystem total + used in bytes.
 * Uses -B1 (1-byte blocks) to get raw byte counts, avoiding locale-dependent
 * decimal separators and the need to multiply by 1024.
 * Returns null on any failure so callers can show "–" gracefully.
 */
export async function getDiskInfo(): Promise<{ total: number; used: number } | null> {
  try {
    const { stdout } = await execFileAsync("df", ["-B1", "/"], {
      timeout: 3000,
      env: { ...process.env, LC_ALL: "C" },
    });
    const combined = stdout.trim().split("\n").slice(1).join(" ").trim();
    const parts = combined.split(/\s+/);
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
 * Returns available=false with an actionable message when Docker is not reachable.
 */
export async function fetchContainers(): Promise<ContainersData> {
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
    rawContainers = await dockerApiRequest<DockerApiContainer[]>("/containers/json?all=true");
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    let reason: string;
    let code: DockerUnavailableCode;
    if (/permission denied|EACCES/i.test(msg)) {
      reason = "Permission denied on Docker socket. Ensure the container's group_add matches the host Docker GID.";
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
    name: (c.Names[0] ?? "").replace(/^\//, ""),
    image: c.Image,
    status: c.Status,
    state: c.State.toLowerCase(),
    project: c.Labels["com.docker.compose.project"] ?? null,
  }));

  return { available: true, containers, unavailableReason: null, unavailableCode: null };
}
