import type { Express } from "express";
import type { Server } from "node:http";
import type pino from "pino";
import type { WebSocketServer } from "ws";
import { VacuumRoutineService } from "./services/vacuum-routine.js";
import { VacuumHaClient } from "./services/vacuum-ha-client.js";
import { vacuumRoutinesRouter } from "./routes/vacuum-routines.js";
import { createVacuumRoutineWebSocket } from "./ws/vacuum-routine-ws.js";
import type { DashboardConfig } from "./config/app-config.js";
import {
  loadLightNotificationEnv,
  isLightNotificationConfigured,
} from "./config/light-notification-env.js";

/**
 * Attach vacuum routine feature to an existing Express app + HTTP server.
 *
 * Call this after createApp() but before finalize().
 * - Creates a VacuumHaClient if HA credentials are available
 * - Registers vacuum routine REST routes on the app
 * - Attaches WebSocket server to the HTTP server
 *
 * HA credentials are shared with the light notification service
 * (LINOS_HA_URL + LINOS_HA_TOKEN). The vacuum entity ID comes from
 * the roborock config section in dashboard.json.
 */
export function setupVacuumRoutines(
  app: Express,
  server: Server,
  logger: pino.Logger,
  dashboardConfig: DashboardConfig
): WebSocketServer {
  const routineLogger = logger.child({ feature: "vacuum-routines" });

  // Build HA client if credentials and vacuum entity are available
  let haClient: VacuumHaClient | null = null;
  const haEnv = loadLightNotificationEnv();
  const vacuumEntityId = dashboardConfig.roborock?.entityId;

  if (haEnv.LINOS_HA_URL && haEnv.LINOS_HA_TOKEN && vacuumEntityId) {
    haClient = new VacuumHaClient(
      routineLogger.child({ component: "ha-client" }),
      haEnv.LINOS_HA_URL,
      haEnv.LINOS_HA_TOKEN,
      vacuumEntityId
    );
    routineLogger.info(
      { entityId: vacuumEntityId },
      "Vacuum HA client initialized — routines will control the vacuum"
    );
  } else {
    routineLogger.warn(
      {
        hasHaUrl: !!haEnv.LINOS_HA_URL,
        hasHaToken: !!haEnv.LINOS_HA_TOKEN,
        hasEntityId: !!vacuumEntityId,
      },
      "Vacuum HA client NOT initialized — missing HA credentials or vacuum entity ID. " +
        "Routine state will be tracked but the vacuum won't move."
    );
  }

  const vacuumRoutineService = new VacuumRoutineService(
    routineLogger,
    dashboardConfig.vacuum,
    dashboardConfig.vacuum?.routines ?? [],
    haClient,
    dashboardConfig.roborock
  );

  // Mount REST routes
  app.use(vacuumRoutinesRouter(vacuumRoutineService));

  // Mount WebSocket (noServer mode — upgrade routing handled in index.ts)
  const wss = createVacuumRoutineWebSocket(server, vacuumRoutineService, routineLogger);

  routineLogger.info({
    routinesCount: dashboardConfig.vacuum?.routines.length ?? 0,
    returnToDockOnPause: dashboardConfig.vacuum?.returnToDockOnPause ?? true,
    haClientActive: haClient !== null,
    segmentMappings: dashboardConfig.roborock?.segments.length ?? 0,
  }, "Vacuum routine feature initialized");

  return wss;
}
