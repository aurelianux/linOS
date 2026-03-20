/**
 * API response envelope types
 */
export interface ApiSuccess<T> {
  ok: true;
  data: T;
}

export interface ApiError {
  ok: false;
  error: {
    message: string;
    code?: string;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

/**
 * Health check response
 */
export interface HealthResponse {
  status: string;
}

/**
 * A single monitored service and its current probe result.
 * Returned by GET /api/services/status
 */
export interface ServiceStatus {
  id: string;
  label: string;
  category: string;
  status: "ok" | "error" | "unknown";
  latencyMs: number | null;
}

/**
 * Host system information.
 * Returned by GET /api/system/info
 */
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

/**
 * Lightweight CPU + RAM vitals for high-frequency polling.
 * Returned by GET /api/system/vitals
 */
export interface SystemVitals {
  cpuLoadPercent: number;
  memoryUsedPercent: number;
}

/**
 * A single Docker container.
 * Returned inside GET /api/system/containers
 */
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

/**
 * Response envelope for GET /api/system/containers
 */
export interface ContainersData {
  available: boolean;
  containers: ContainerInfo[];
  /** Set when available is false — explains why Docker is unreachable */
  unavailableReason: string | null;
  /** Machine-readable error code for frontend conditional rendering */
  unavailableCode: DockerUnavailableCode | null;
}

/**
 * Dashboard entity configuration.
 * Returned by GET /api/dashboard/config
 */
export interface DashboardRoom {
  id: string;
  name: string;
  /** MDI icon name string, e.g. "mdiSofa" — resolved via resolveDashboardIcon() */
  icon: string;
  /** HA entity IDs to display as individual cards */
  entities: string[];
}

export interface DashboardConfig {
  rooms: DashboardRoom[];
}

/**
 * API error class for typed error handling
 */
export class ApiErrorException extends Error {
  constructor(
    public message: string,
    public code?: string
  ) {
    super(message);
    this.name = "ApiErrorException";
  }
}
