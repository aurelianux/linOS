import { z, type ZodError } from "zod";

/**
 * Environment configuration schema using Zod for validation
 * Ensures type safety and validates all required env vars at startup
 */
const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production"]).default("development"),
  PORT: z.coerce.number().default(4001),
  LOG_LEVEL: z
    .enum(["fatal", "error", "warn", "info", "debug", "trace"])
    .default("info"),

  // CORS configuration (LAN-first approach)
  // Default: localhost:4000 (dev) + dashboard.lan
  CORS_ALLOW_ORIGINS: z.string().default("http://localhost:4000,http://dashboard.lan"),

  // Dashboard host name (used in config/CORS defaults)
  LINOS_DASHBOARD_HOST: z.string().default("dashboard.lan"),

  // Optional path to JSON app config file (rooms, favorites, actions)
  CONFIG_PATH: z.string().optional(),

  // Home Assistant integration (optional)
  HA_URL: z.string().url().optional(),   // e.g. http://homeassistant.local:8123
  HA_TOKEN: z.string().optional(),       // Long-Lived Access Token
});

export type Env = z.infer<typeof envSchema>;

/**
 * Parse and validate environment variables at startup
 * Throws early if validation fails
 */
export function loadEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const zodError = result.error as ZodError;
    console.error("❌ Environment validation failed:", zodError.issues);
    process.exit(1);
  }

  return result.data;
}
