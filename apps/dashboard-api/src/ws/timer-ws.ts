import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "node:http";
import type pino from "pino";
import type { TimerService, TimerState } from "../services/timer.js";

/**
 * WebSocket server for real-time timer state broadcasts.
 *
 * - Mounts on the existing HTTP server at path /ws/timer
 * - Sends current state to each new client on connect
 * - Broadcasts state changes to all connected clients
 */
export function createTimerWebSocket(
  server: Server,
  timerService: TimerService,
  logger: pino.Logger
): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws/timer" });

  const log = logger.child({ component: "timer-ws" });

  wss.on("connection", (ws: WebSocket) => {
    log.debug("Client connected");

    // Send current state immediately
    const state = timerService.getState();
    ws.send(JSON.stringify(state));

    ws.on("close", () => {
      log.debug("Client disconnected");
    });

    ws.on("error", (err: Error) => {
      log.warn({ err: err.message }, "WebSocket client error");
    });
  });

  // Broadcast on every timer state change
  timerService.onChange((state: TimerState) => {
    const message = JSON.stringify(state);
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    }
  });

  log.info("Timer WebSocket server mounted at /ws/timer");

  return wss;
}
