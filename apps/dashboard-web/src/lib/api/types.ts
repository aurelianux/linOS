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
  /** Docker Compose project name, or null if not a compose container */
  project: string | null;
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
/**
 * Air quality sensor grouping for a room.
 * Renders as a single composite card instead of individual SensorCards.
 */
export interface AirQualityConfig {
  temperature: `sensor.${string}`;
  humidity: `sensor.${string}`;
  secondary: Array<`sensor.${string}`>;
}

export interface DashboardRoom {
  id: string;
  name: string;
  /** MDI icon name string, e.g. "mdiSofa" — resolved via resolveDashboardIcon() */
  icon: string;
  /** HA entity IDs to display as individual cards */
  entities: string[];
  /** Composite air quality sensor card config */
  airQuality?: AirQualityConfig;
}

/**
 * Quick toggle configuration for room lighting modes.
 */
export interface RoomQuickToggle {
  roomId: string;
  entity: `input_select.${string}`;
}

export interface QuickToggleConfig {
  globalEntity: `input_select.${string}`;
  modes: string[];
  rooms: RoomQuickToggle[];
}

/**
 * Light color preset.
 * displayColor is for the UI indicator only.
 * Either colorTemp (mireds) or hsColor ([hue, saturation]) defines the actual light value.
 */
export interface LightColorPreset {
  id: string;
  label: string;
  displayColor: string;
  colorTemp?: number;
  hsColor?: [number, number];
}

export interface RoborockSegment {
  id: number;
  roomId: string;
  defaultSelected: boolean;
}

export interface RoborockConfig {
  entityId: string;
  segments: RoborockSegment[];
  defaultFanPower: number;
  defaultWaterBoxMode: number;
  defaultCleaningMode: "vacuum" | "vacuum_and_mop";
}

export interface VacuumRoutineStep {
  mode: "vacuum" | "vacuum_and_mop";
  segments: string[];
  fanPower: number;
  waterBoxMode: number | null;
}

export interface VacuumRoutine {
  id: string;
  label: string;
  description?: string;
  steps: VacuumRoutineStep[];
}

export interface VacuumConfig {
  returnToDockOnPause: boolean;
  routines: VacuumRoutine[];
}

export interface AdminStack {
  projectName: string;
  label: string;
  composePath?: string;
}

export interface DashboardConfig {
  rooms: DashboardRoom[];
  roborock?: RoborockConfig;
  vacuum?: VacuumConfig;
  quickToggles?: QuickToggleConfig;
  lightColorPresets?: LightColorPreset[];
  adminStacks?: AdminStack[];
}

export interface StackRestartResult {
  restarted: string[];
  failed: string[];
}

export interface ContainerRestartResult {
  name: string;
  success: boolean;
}

export interface ContainerLogsResult {
  logs: string;
}

export interface GitPullResult {
  stdout: string;
  stderr: string;
}

export interface GitStatus {
  branch: string;
  lastCommit: { hash: string; message: string; relativeTime: string };
  ahead: number;
  behind: number;
  dirty: number;
  untracked: number;
}

/**
 * API error class for typed error handling
 */
export class ApiErrorException extends Error {
  public message: string;
  public code?: string;

  constructor(message: string, code?: string) {
    super(message);
    this.message = message;
    this.code = code;
    this.name = "ApiErrorException";
  }
}
