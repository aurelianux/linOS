import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "node:http";
import type pino from "pino";
import type { VacuumRoutineService, VacuumRoutineState } from "../services/vacuum-routine.js";

/**
 * WebSocket server for real-time vacuum routine state broadcasts.
 *
 * - Mounts on the existing HTTP server at path /ws/vacuum-routines
 * - Sends current state to each new client on connect
 * - Broadcasts state changes to all connected clients
 */
export function createVacuumRoutineWebSocket(
  server: Server,
  service: VacuumRoutineService,
  logger: pino.Logger
): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws/vacuum-routines" });

  const log = logger.child({ component: "vacuum-routine-ws" });

  wss.on("connection", (ws: WebSocket) => {
    log.debug("Client connected");

    // Send current state immediately
    const state = service.getState();
    ws.send(JSON.stringify(state));

    ws.on("close", () => {
      log.debug("Client disconnected");
    });

    ws.on("error", (err: Error) => {
      log.warn({ err: err.message }, "WebSocket client error");
    });
  });

  // Broadcast on every routine state change
  service.onChange((state: VacuumRoutineState) => {
    const message = JSON.stringify(state);
    for (const client of wss.clients) {
      if (client.readyState === client.OPEN) {
        client.send(message);
      }
    }
  });

  log.info("Vacuum routine WebSocket server mounted at /ws/vacuum-routines");

  return wss;
}
