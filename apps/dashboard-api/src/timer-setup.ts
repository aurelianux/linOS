import type { Express } from "express";
import type { Server } from "node:http";
import type pino from "pino";
import { TimerService } from "./services/timer.js";
import { timerRouter } from "./routes/timer.js";
import { createTimerWebSocket } from "./ws/timer-ws.js";
import { loadTimerEnv, parseTimerLightEntities } from "./config/timer-env.js";

/**
 * Attach timer feature to an existing Express app + HTTP server.
 *
 * Call this after createApp() but before or after listen().
 * - Registers timer REST routes on the app
 * - Attaches WebSocket server to the HTTP server
 * - Optionally configures HA light feedback from env vars
 */
export function setupTimer(
  app: Express,
  server: Server,
  logger: pino.Logger
): TimerService {
  const timerLogger = logger.child({ feature: "timer" });
  const timerService = new TimerService(timerLogger);

  // Load optional HA light config
  const timerEnv = loadTimerEnv();
  const lightEntities = parseTimerLightEntities(timerEnv.LINOS_TIMER_LIGHT_ENTITIES);

  if (timerEnv.LINOS_HA_URL && timerEnv.LINOS_HA_TOKEN && lightEntities.length > 0) {
    timerService.configureLights({
      haUrl: timerEnv.LINOS_HA_URL,
      haToken: timerEnv.LINOS_HA_TOKEN,
      lightEntities,
    });
  } else {
    timerLogger.info("Timer light feedback not configured (LINOS_HA_URL, LINOS_HA_TOKEN, LINOS_TIMER_LIGHT_ENTITIES)");
  }

  // Mount REST routes
  app.use(timerRouter(timerService));

  // Mount WebSocket
  createTimerWebSocket(server, timerService, timerLogger);

  timerLogger.info("Timer feature initialized");

  return timerService;
}
