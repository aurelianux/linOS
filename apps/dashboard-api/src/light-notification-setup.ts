import type pino from "pino";
import { LightNotificationService } from "./services/light-notification.js";
import {
  loadLightNotificationEnv,
  parseLightEntities,
  isLightNotificationConfigured,
} from "./config/light-notification-env.js";

interface LightNotificationSetupResult {
  service: LightNotificationService | null;
  entityIds: string[];
}

/**
 * Initialize the light notification service from environment variables.
 * Returns null service if HA credentials or entity IDs are not configured.
 */
export function setupLightNotification(
  logger: pino.Logger
): LightNotificationSetupResult {
  const env = loadLightNotificationEnv();
  const entityIds = parseLightEntities(env.LINOS_NOTIFICATION_LIGHT_ENTITIES);

  if (!isLightNotificationConfigured(env)) {
    logger.info(
      "Light notification not configured (LINOS_HA_URL, LINOS_HA_TOKEN, LINOS_NOTIFICATION_LIGHT_ENTITIES)"
    );
    return { service: null, entityIds: [] };
  }

  // At this point we know these are defined (isConfigured checked them)
  const lightLogger = logger.child({ service: "light-notification" });
  const service = new LightNotificationService(
    lightLogger,
    env.LINOS_HA_URL as string,
    env.LINOS_HA_TOKEN as string
  );

  lightLogger.info(
    { entityIds },
    "Light notification service initialized"
  );

  return { service, entityIds };
}

/**
 * Register SIGTERM/SIGINT handlers that stop all active light sessions
 * on graceful shutdown.
 */
export function registerLightNotificationShutdown(
  service: LightNotificationService,
  logger: pino.Logger
): void {
  const shutdown = () => {
    service.stopAll().catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error({ err: msg }, "Failed to stop light sessions on shutdown");
    });
  };

  process.on("SIGTERM", shutdown);
  process.on("SIGINT", shutdown);
}
