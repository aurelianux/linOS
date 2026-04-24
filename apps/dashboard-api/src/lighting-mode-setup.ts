import type { Express } from "express";
import type pino from "pino";
import { LightingModeService } from "./services/lighting-mode.js";
import { lightingModeRouter } from "./routes/lighting-mode.js";
import type { DashboardConfig } from "./config/app-config.js";
import { loadLightNotificationEnv } from "./config/light-notification-env.js";

/**
 * Attach the lighting mode feature to an existing Express app.
 *
 * Call this after createApp() but before finalize().
 * HA credentials are shared with the light-notification service
 * (LINOS_HA_URL + LINOS_HA_TOKEN). Mode definitions come from
 * dashboardConfig.quickToggles in dashboard.json.
 *
 * Routes are always mounted so the frontend receives proper error codes
 * even when HA is not configured (GET /mode works; POST returns 503).
 */
export function setupLightingMode(
  app: Express,
  logger: pino.Logger,
  dashboardConfig: DashboardConfig
): void {
  const modeLogger = logger.child({ feature: "lighting-mode" });

  const haEnv = loadLightNotificationEnv();

  if (!haEnv.LINOS_HA_URL || !haEnv.LINOS_HA_TOKEN) {
    modeLogger.warn(
      { hasHaUrl: !!haEnv.LINOS_HA_URL, hasHaToken: !!haEnv.LINOS_HA_TOKEN },
      "HA credentials not set — GET /mode works but POST will return 503"
    );
  }

  const service = new LightingModeService(
    modeLogger,
    haEnv.LINOS_HA_URL ?? "",
    haEnv.LINOS_HA_TOKEN ?? "",
    dashboardConfig.quickToggles
  );

  app.use(lightingModeRouter(service));

  modeLogger.info(
    {
      modes: service.getValidModes(),
      rooms: service.getValidRooms(),
      haConfigured: !!(haEnv.LINOS_HA_URL && haEnv.LINOS_HA_TOKEN),
    },
    "Lighting mode feature initialized"
  );
}
