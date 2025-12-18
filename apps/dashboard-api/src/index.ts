import { loadEnv } from "./config/env.js";
import { loadAppConfig } from "./config/app-config.js";
import { createApp } from "./app.js";

/**
 * Bootstrap the dashboard API
 * 1. Load environment variables (with validation)
 * 2. Load app configuration (rooms, favorites, actions)
 * 3. Create and start Express app
 */
async function main() {
  // Load and validate environment
  const env = loadEnv();

  // Load app configuration
  const appConfig = loadAppConfig(env.CONFIG_PATH);

  // Create app
  const { app, logger } = createApp(env);

  // Log startup info
  logger.info(
    {
      port: env.PORT,
      env: env.NODE_ENV,
      logLevel: env.LOG_LEVEL,
      corsOrigins: env.CORS_ALLOW_ORIGINS,
    },
    "Starting dashboard-api"
  );

  // Start server
  app.listen(env.PORT, () => {
    logger.info(`✓ Dashboard API listening on http://localhost:${env.PORT}`);
    logger.debug({ appConfig }, "App config loaded");
  });
}

main().catch((err) => {
  console.error("Failed to start dashboard-api:", err);
  process.exit(1);
});

