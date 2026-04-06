import type { Express } from "express";
import type { Server } from "node:http";
import type pino from "pino";
import type { WebSocketServer } from "ws";
import { VacuumRoutineService } from "./services/vacuum-routine.js";
import { vacuumRoutinesRouter } from "./routes/vacuum-routines.js";
import { createVacuumRoutineWebSocket } from "./ws/vacuum-routine-ws.js";
import type { DashboardConfig } from "./config/app-config.js";

/**
 * Attach vacuum routine feature to an existing Express app + HTTP server.
 *
 * Call this after createApp() but before finalize().
 * - Registers vacuum routine REST routes on the app
 * - Attaches WebSocket server to the HTTP server
 */
export function setupVacuumRoutines(
  app: Express,
  server: Server,
  logger: pino.Logger,
  dashboardConfig: DashboardConfig
): WebSocketServer {
  const routineLogger = logger.child({ feature: "vacuum-routines" });

  const vacuumRoutineService = new VacuumRoutineService(
    routineLogger,
    dashboardConfig.vacuum,
    dashboardConfig.vacuum?.routines ?? []
  );

  // Mount REST routes
  app.use(vacuumRoutinesRouter(vacuumRoutineService));

  // Mount WebSocket (noServer mode — upgrade routing handled in index.ts)
  const wss = createVacuumRoutineWebSocket(server, vacuumRoutineService, routineLogger);

  routineLogger.info({
    routinesCount: dashboardConfig.vacuum?.routines.length ?? 0,
    returnToDockOnPause: dashboardConfig.vacuum?.returnToDockOnPause ?? true,
  }, "Vacuum routine feature initialized");

  return wss;
}
