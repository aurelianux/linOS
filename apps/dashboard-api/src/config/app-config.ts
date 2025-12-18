import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

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
