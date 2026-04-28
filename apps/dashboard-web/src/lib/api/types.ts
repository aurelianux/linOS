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
 * NVIDIA GPU metrics from berta-agent.
 */
export interface GpuMetrics {
  name: string;
  utilizationPercent: number;
  memoryUsedMiB: number;
  memoryTotalMiB: number;
}

/**
 * Berta host system metrics.
 * Returned inside GET /api/system/berta
 */
export interface BertaMetrics {
  hostname: string;
  uptimeSeconds: number;
  cpuLoadPercent: number;
  totalMemoryBytes: number;
  freeMemoryBytes: number;
  gpu: GpuMetrics | null;
}

/**
 * Response envelope for GET /api/system/berta.
 * available=false when berta-agent is unreachable or not configured.
 */
export interface BertaData {
  available: boolean;
  metrics: BertaMetrics | null;
  unavailableReason: string | null;
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
 * Target state for a light entity within a mode definition.
 * Mirrors the backend shape — consumed from dashboard.json via GET /api/dashboard/config.
 */
export interface LightEntityState {
  state: "on" | "off";
  brightness?: number;
  color_temp?: number;
}

/**
 * Quick toggle configuration for room lighting modes.
 * The backend LightingModeService owns the actual HA scene.apply call —
 * the frontend only needs to know which rooms have a toggle.
 */
export interface RoomQuickToggle {
  roomId: string;
  modeConfig: Record<string, Record<string, LightEntityState>>;
}

export interface QuickToggleConfig {
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

/**
 * Real-time vacuum routine execution state.
 * Received via WebSocket from /ws/vacuum-routines.
 */
export interface VacuumRoutineState {
  executionState: "idle" | "scheduled" | "running" | "paused" | "error";
  currentRoutineId: string | null;
  currentStepIndex: number;
  totalSteps: number;
  scheduledAt: number | null;
  startedAt: number | null;
  pausedAt: number | null;
  errorMessage: string | null;
}

export interface MotionSensorConfig {
  id: string;
  entityId: `binary_sensor.${string}`;
}

export interface DashboardConfig {
  rooms: DashboardRoom[];
  motionSensors?: MotionSensorConfig[];
  roborock?: RoborockConfig;
  vacuum?: VacuumConfig;
  quickToggles?: QuickToggleConfig;
  lightColorPresets?: LightColorPreset[];
  adminStacks?: AdminStack[];
}

/**
 * Response from POST /admin/stack/:project/restart.
 * A build has been LAUNCHED on the host, not finished — poll the build-status
 * endpoint with `buildId` to observe progress.
 */
export interface StackBuildStartResult {
  projectName: string;
  buildId: string;
  pid: number;
  logPath: string;
  startedAt: string;
  commitHash: string;
}

export type BuildState = "running" | "success" | "failed" | "stalled" | "unknown";

/**
 * Response from GET /admin/stack/:project/build-status?buildId=…
 */
export interface StackBuildStatus {
  buildId: string;
  state: BuildState;
  exitCode: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  commitHash: string | null;
  /** Last ~40 non-empty lines of the build log, oldest first. */
  tail: string[];
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
 * Current lighting mode per room.
 * Returned by GET /api/mode. Values are "hell" | "chill" | "aus" | "unknown".
 */
export type ModeState = Record<string, string>;

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
