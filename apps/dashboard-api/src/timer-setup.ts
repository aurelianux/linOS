import type { Express } from "express";
import type { Server } from "node:http";
import type pino from "pino";
import type { WebSocketServer } from "ws";
import type { LightNotificationService } from "./services/light-notification.js";
import { TimerService } from "./services/timer.js";
import { timerRouter } from "./routes/timer.js";
import { createTimerWebSocket } from "./ws/timer-ws.js";

/**
 * Attach timer feature to an existing Express app + HTTP server.
 *
 * Call this after createApp() but before finalize().
 * - Registers timer REST routes on the app
 * - Attaches WebSocket server to the HTTP server
 * - Optionally configures light feedback if a LightNotificationService is provided
 */
export function setupTimer(
  app: Express,
  server: Server,
  logger: pino.Logger,
  lightNotification: LightNotificationService | null,
  lightEntityIds: string[]
): WebSocketServer {
  const timerLogger = logger.child({ feature: "timer" });
  const timerService = new TimerService(timerLogger);

  // Configure light feedback if the service is available
  if (lightNotification && lightEntityIds.length > 0) {
    timerService.configureLights(lightNotification, lightEntityIds);
  } else {
    timerLogger.info("Timer light feedback not available (light notification service not configured)");
  }

  // Mount REST routes
  app.use(timerRouter(timerService));

  // Mount WebSocket (noServer mode — upgrade routing handled in index.ts)
  const wss = createTimerWebSocket(server, timerService, timerLogger);

  timerLogger.info("Timer feature initialized");

  return wss;
}
