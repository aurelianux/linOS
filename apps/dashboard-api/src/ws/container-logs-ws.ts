import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "node:http";
import type pino from "pino";
import { followContainerLogs } from "./container-logs-ws.helpers.js";

const INITIAL_TAIL_LINES = 200;

// ─── WS message types ─────────────────────────────────────────────────────

interface SubscribeMessage { action: "subscribe"; containerId: string; tail?: number; }
interface UnsubscribeMessage { action: "unsubscribe"; }
interface LinesMessage { type: "lines"; data: string[]; }
interface SubscribedMessage { type: "subscribed"; containerId: string; }
interface ErrorMessage { type: "error"; message: string; }
type ServerMessage = LinesMessage | SubscribedMessage | ErrorMessage;

// ─── Helpers ──────────────────────────────────────────────────────────────

function isSubscribeMessage(msg: unknown): msg is SubscribeMessage {
  return (
    typeof msg === "object" && msg !== null && "action" in msg &&
    (msg as Record<string, unknown>).action === "subscribe" &&
    "containerId" in msg &&
    typeof (msg as Record<string, unknown>).containerId === "string"
  );
}

function isUnsubscribeMessage(msg: unknown): msg is UnsubscribeMessage {
  return (
    typeof msg === "object" && msg !== null && "action" in msg &&
    (msg as Record<string, unknown>).action === "unsubscribe"
  );
}

function sendJson(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) ws.send(JSON.stringify(msg));
}

// ─── WebSocket Server ─────────────────────────────────────────────────────

export function createContainerLogsWebSocket(_server: Server, logger: pino.Logger): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const log = logger.child({ component: "container-logs-ws" });

  wss.on("connection", (ws: WebSocket) => {
    log.debug("Client connected");
    let stopFollowing: (() => void) | null = null;

    const cleanup = (): void => {
      if (stopFollowing) { stopFollowing(); stopFollowing = null; }
    };

    ws.on("message", (raw: Buffer | string) => {
      let msg: unknown;
      try {
        msg = JSON.parse(typeof raw === "string" ? raw : raw.toString());
      } catch {
        sendJson(ws, { type: "error", message: "Invalid JSON" });
        return;
      }

      if (isSubscribeMessage(msg)) {
        cleanup();
        const { containerId, tail } = msg;
        const tailLines = tail ?? INITIAL_TAIL_LINES;
        log.debug({ containerId, tail: tailLines }, "Subscribing to container logs");
        stopFollowing = followContainerLogs(
          containerId,
          tailLines,
          (lines) => sendJson(ws, { type: "lines", data: lines }),
          (err) => {
            log.warn({ containerId, err: err.message }, "Log stream error");
            sendJson(ws, { type: "error", message: err.message });
            cleanup();
          },
        );
        sendJson(ws, { type: "subscribed", containerId });
      } else if (isUnsubscribeMessage(msg)) {
        cleanup();
      }
    });

    ws.on("close", () => { log.debug("Client disconnected"); cleanup(); });
    ws.on("error", (err: Error) => { log.warn({ err: err.message }, "WebSocket client error"); cleanup(); });
  });

  log.info("Container logs WebSocket server mounted at /ws/container-logs");
  return wss;
}
