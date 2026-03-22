import { loadEnv } from "./config/env.js";
import { loadAppConfig, loadServicesConfig, loadDashboardConfig } from "./config/app-config.js";
import { createApp, finalize } from "./app.js";
import { setupLightNotification, registerLightNotificationShutdown } from "./light-notification-setup.js";
import { setupTimer } from "./timer-setup.js";

/**
 * Bootstrap the dashboard API
 * 1. Load environment variables (with validation)
 * 2. Load app configuration (rooms, favorites, actions)
 * 3. Load services monitoring configuration
 * 4. Create and start Express app
 */
async function main() {
  // Load and validate environment
  const env = loadEnv();

  // Load app configuration
  const appConfig = loadAppConfig(env.CONFIG_PATH);

  // Load services monitoring configuration
  const servicesConfig = loadServicesConfig(env.SERVICES_CONFIG_PATH);

  // Load dashboard entity configuration
  const dashboardConfig = loadDashboardConfig(env.DASHBOARD_CONFIG_PATH);

  // Create app
  const { app, logger } = createApp(env, servicesConfig, dashboardConfig);

  // Log startup info
  logger.info(
    {
      port: env.PORT,
      env: env.NODE_ENV,
      logLevel: env.LOG_LEVEL,
      corsOrigins: env.CORS_ALLOW_ORIGINS,
      monitoredServices: servicesConfig.services.length,
    },
    "Starting dashboard-api"
  );

  // Start server
  const server = app.listen(env.PORT, () => {
    logger.info(`✓ Dashboard API listening on http://localhost:${env.PORT}`);
    logger.debug({ appConfig }, "App config loaded");
  });

  // Initialize light notification service (used by timer and future features)
  const { service: lightNotification, entityIds: lightEntityIds } =
    setupLightNotification(logger);

  if (lightNotification) {
    registerLightNotificationShutdown(lightNotification, logger);
  }

  // Attach timer feature (REST routes + WebSocket)
  setupTimer(app, server, logger, lightNotification, lightEntityIds);

  // Finalize: register catch-all 404 + error handlers after all routes
  finalize(app, logger);
}

main().catch((err) => {
  console.error("Failed to start dashboard-api:", err);
  process.exit(1);
});
