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

/**
 * A single service/stack definition.
 * healthUrl (optional) is probed via HTTP GET; any 2xx/3xx response counts as "ok".
 * stackPath (optional) is the relative path to the Docker Compose stack directory.
 * Services without healthUrl are skipped during health monitoring.
 */
export interface ServiceEntry {
  id: string;
  label: string;
  category: string;
  healthUrl?: string | undefined;
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
