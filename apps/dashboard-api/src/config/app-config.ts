import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { z } from "zod";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Application configuration schema
 * Loaded from optional JSON config file (e.g., rooms, favorites, actions)
 * Currently a stub for future expansion
 */
export interface AppConfig {
  rooms?: unknown;
  favorites?: unknown;
  actions?: unknown;
  [key: string]: unknown;
}

/**
 * Load app configuration from JSON file (if CONFIG_PATH is set)
 * Gracefully falls back to empty config if file missing or parse fails
 */
export function loadAppConfig(configPath?: string): AppConfig {
  if (!configPath) {
    return {};
  }

  try {
    const fullPath = path.isAbsolute(configPath)
      ? configPath
      : path.join(__dirname, configPath);

    if (!fs.existsSync(fullPath)) {
      console.warn(`⚠️  Config file not found: ${fullPath}, using defaults`);
      return {};
    }

    const content = fs.readFileSync(fullPath, "utf-8");
    const config = JSON.parse(content);

    console.log(`✓ Loaded app config from: ${fullPath}`);
    return config;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️  Failed to load config: ${message}, using defaults`);
    return {};
  }
}

// ─── Dashboard entity config ─────────────────────────────────────────────────

export interface AirQualityConfig {
  temperature: string;
  humidity: string;
  secondary: string[];
}

export interface DashboardRoom {
  id: string;
  name: string;
  /** MDI icon name, e.g. "mdiSofa" */
  icon: string;
  /** HA entity IDs to display as individual cards */
  entities: string[];
  airQuality?: AirQualityConfig | undefined;
}

export interface RoomQuickToggle {
  roomId: string;
  entity: string;
}

export interface QuickToggleConfig {
  globalEntity: string;
  modes: string[];
  rooms: RoomQuickToggle[];
}

export interface LightColorPreset {
  id: string;
  label: string;
  displayColor: string;
  colorTemp?: number | undefined;
  hsColor?: [number, number] | undefined;
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

export interface AdminStack {
  projectName: string;
  label: string;
}

export interface DashboardConfig {
  rooms: DashboardRoom[];
  roborock?: RoborockConfig | undefined;
  quickToggles?: QuickToggleConfig | undefined;
  lightColorPresets?: LightColorPreset[] | undefined;
  adminStacks?: AdminStack[] | undefined;
}

const airQualitySchema = z.object({
  temperature: z.string().min(1),
  humidity: z.string().min(1),
  secondary: z.array(z.string().min(1)).default([]),
});

const dashboardRoomSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  icon: z.string().min(1),
  entities: z.array(z.string().min(1)).default([]),
  airQuality: airQualitySchema.optional(),
});

const roomQuickToggleSchema = z.object({
  roomId: z.string().min(1),
  entity: z.string().min(1),
});

const quickToggleConfigSchema = z.object({
  globalEntity: z.string().min(1),
  modes: z.array(z.string().min(1)).min(1),
  rooms: z.array(roomQuickToggleSchema),
});

const lightColorPresetSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  displayColor: z.string().min(1),
  colorTemp: z.number().int().positive().optional(),
  hsColor: z.tuple([z.number(), z.number()]).optional(),
});

const roborockSegmentSchema = z.object({
  id: z.number().int().positive(),
  roomId: z.string().min(1),
  defaultSelected: z.boolean(),
});

const roborockConfigSchema = z.object({
  entityId: z.string().min(1),
  segments: z.array(roborockSegmentSchema).min(1),
  defaultFanPower: z.number().int(),
  defaultWaterBoxMode: z.number().int(),
  defaultCleaningMode: z.enum(["vacuum", "vacuum_and_mop"]),
});

const adminStackSchema = z.object({
  projectName: z.string().min(1),
  label: z.string().min(1),
});

const dashboardConfigSchema = z.object({
  rooms: z.array(dashboardRoomSchema),
  roborock: roborockConfigSchema.optional(),
  quickToggles: quickToggleConfigSchema.optional(),
  lightColorPresets: z.array(lightColorPresetSchema).optional(),
  adminStacks: z.array(adminStackSchema).optional(),
});

/**
 * Load dashboard entity config from JSON file.
 * Defaults to config/dashboard.json at the repo root.
 * Validates structure with Zod; gracefully returns empty config on failure.
 */
export function loadDashboardConfig(configPath?: string): DashboardConfig {
  const defaultPath = path.join(__dirname, "../../../../config/dashboard.json");
  const resolvedPath = configPath
    ? path.isAbsolute(configPath)
      ? configPath
      : path.resolve(process.cwd(), configPath)
    : defaultPath;

  try {
    if (!fs.existsSync(resolvedPath)) {
      console.warn(
        `⚠️  Dashboard config not found: ${resolvedPath}, using empty config`
      );
      return { rooms: [] };
    }

    const content = fs.readFileSync(resolvedPath, "utf-8");
    const parsed: unknown = JSON.parse(content);
    const result = dashboardConfigSchema.safeParse(parsed);

    if (!result.success) {
      console.warn(
        `⚠️  Dashboard config validation failed: ${result.error.message}`
      );
      return { rooms: [] };
    }

    console.log(`✓ Loaded dashboard config from: ${resolvedPath}`);
    return result.data;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️  Failed to load dashboard config: ${message}`);
    return { rooms: [] };
  }
}

// ─── Services config ──────────────────────────────────────────────────────────

/**
 * A single service/stack definition.
 * healthUrl (optional) is probed via HTTP GET; any 2xx/3xx response counts as "ok".
 * healthType (optional) defaults to "http". Use "tcp" for non-HTTP services (e.g. MQTT).
 * healthHost + healthPort (optional) are required when healthType is "tcp".
 * stackPath (optional) is the relative path to the Docker Compose stack directory.
 * Services without healthUrl (and without healthType "tcp") are skipped during health monitoring.
 */
export interface ServiceEntry {
  id: string;
  label: string;
  category: string;
  healthUrl?: string | undefined;
  healthType?: "http" | "tcp" | undefined;
  healthHost?: string | undefined;
  healthPort?: number | undefined;
  stackPath?: string | undefined;
}

export interface ServicesConfig {
  services: ServiceEntry[];
}

const serviceEntrySchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  category: z.string().min(1),
  healthUrl: z.string().url().optional(),
  healthType: z.enum(["http", "tcp"]).optional(),
  healthHost: z.string().optional(),
  healthPort: z.number().int().positive().optional(),
  stackPath: z.string().optional(),
});

const servicesConfigSchema = z.object({
  services: z.array(serviceEntrySchema),
});

/**
 * Load services monitoring config from JSON file.
 * Defaults to config/services.json at the repo root relative to this source file.
 * Validates structure with Zod; gracefully returns an empty list when the file
 * is missing, unreadable, or fails validation.
 */
export function loadServicesConfig(configPath?: string): ServicesConfig {
  // Default: navigate from src/config/ up four levels to repo root
  const defaultPath = path.join(__dirname, "../../../../config/services.json");
  const resolvedPath = configPath
    ? path.isAbsolute(configPath)
      ? configPath
      : path.resolve(process.cwd(), configPath)
    : defaultPath;

  try {
    if (!fs.existsSync(resolvedPath)) {
      console.warn(
        `⚠️  Services config not found: ${resolvedPath}, monitoring disabled`
      );
      return { services: [] };
    }

    const content = fs.readFileSync(resolvedPath, "utf-8");
    const parsed: unknown = JSON.parse(content);
    const result = servicesConfigSchema.safeParse(parsed);

    if (!result.success) {
      console.warn(
        `⚠️  Services config validation failed: ${result.error.message}`
      );
      return { services: [] };
    }

    console.log(`✓ Loaded services config from: ${resolvedPath}`);
    return result.data;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.warn(`⚠️  Failed to load services config: ${message}`);
    return { services: [] };
  }
}
