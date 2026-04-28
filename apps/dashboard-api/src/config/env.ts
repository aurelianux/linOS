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

  // Optional path to services monitoring config file
  // Defaults to config/services.json at the repo root
  SERVICES_CONFIG_PATH: z.string().optional(),

  // Optional path to dashboard entity config file
  // Defaults to config/dashboard.json at the repo root
  DASHBOARD_CONFIG_PATH: z.string().optional(),

  // Berta host IP — used to reach the berta-agent metrics service
  LINOS_HOST_BERTA_IP: z.string().optional(),
  BERTA_AGENT_PORT: z.coerce.number().default(4002),

  // Optional SSH target used by /admin/git-pull endpoint
  LINOS_GIT_PULL_SSH_HOST: z.string().optional(),
  LINOS_GIT_PULL_SSH_PORT: z.coerce.number().int().positive().optional(),
  LINOS_GIT_PULL_SSH_USER: z.string().optional(),
  LINOS_GIT_PULL_SSH_PRIVATE_KEY_PATH: z.string().optional(),
  LINOS_GIT_PULL_SSH_PRIVATE_KEY_PASSPHRASE: z.string().optional(),
  LINOS_GIT_PULL_REMOTE_REPO_PATH: z.string().optional(),
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
