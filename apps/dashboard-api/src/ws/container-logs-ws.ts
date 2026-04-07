import http from "http";
import { WebSocketServer, type WebSocket } from "ws";
import type { Server } from "node:http";
import type pino from "pino";
import { parseDockerLogs } from "../routes/system.js";

const DOCKER_SOCKET = "/var/run/docker.sock";

/** Max lines to send on initial subscribe */
const INITIAL_TAIL_LINES = 200;

/** How many bytes to buffer before flushing to WS clients */
const FLUSH_INTERVAL_MS = 250;

// ─── WS message types ─────────────────────────────────────────────────────

interface SubscribeMessage {
  action: "subscribe";
  containerId: string;
  tail?: number;
}

interface UnsubscribeMessage {
  action: "unsubscribe";
}

type ClientMessage = SubscribeMessage | UnsubscribeMessage;

interface LinesMessage {
  type: "lines";
  data: string[];
}

interface SubscribedMessage {
  type: "subscribed";
  containerId: string;
}

interface ErrorMessage {
  type: "error";
  message: string;
}

type ServerMessage = LinesMessage | SubscribedMessage | ErrorMessage;

// ─── Helpers ──────────────────────────────────────────────────────────────

function isSubscribeMessage(msg: unknown): msg is SubscribeMessage {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "action" in msg &&
    (msg as Record<string, unknown>).action === "subscribe" &&
    "containerId" in msg &&
    typeof (msg as Record<string, unknown>).containerId === "string"
  );
}

function isUnsubscribeMessage(msg: unknown): msg is UnsubscribeMessage {
  return (
    typeof msg === "object" &&
    msg !== null &&
    "action" in msg &&
    (msg as Record<string, unknown>).action === "unsubscribe"
  );
}

function sendJson(ws: WebSocket, msg: ServerMessage): void {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(msg));
  }
}

/**
 * Follows Docker container logs in real-time via the Engine API stream.
 * Returns an abort function to stop following.
 */
function followContainerLogs(
  containerId: string,
  tail: number,
  onLines: (lines: string[]) => void,
  onError: (err: Error) => void,
  logger: pino.Logger,
): () => void {
  let aborted = false;
  let currentReq: http.ClientRequest | null = null;

  const path = `/containers/${containerId}/logs?stdout=1&stderr=1&timestamps=1&follow=1&tail=${tail}`;

  const req = http.request(
    { socketPath: DOCKER_SOCKET, path, method: "GET" },
    (res) => {
      if (!res.statusCode || res.statusCode >= 400) {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString();
          onError(new Error(`Docker API ${res.statusCode}: ${body.slice(0, 200)}`));
        });
        return;
      }

      // Buffer partial data and flush at intervals for batching
      let pendingBuffer = Buffer.alloc(0);
      let flushTimer: ReturnType<typeof setTimeout> | null = null;

      const flushPending = (): void => {
        if (pendingBuffer.length === 0) return;
        const text = parseDockerLogs(pendingBuffer);
        pendingBuffer = Buffer.alloc(0);

        if (text.length > 0) {
          // Split into individual lines, filter empty
          const lines = text.split("\n").filter((l) => l.length > 0);
          if (lines.length > 0) {
            onLines(lines);
          }
        }
      };

      res.on("data", (chunk: Buffer) => {
        if (aborted) return;
        pendingBuffer = Buffer.concat([pendingBuffer, chunk]);

        // Flush at a capped interval to avoid overwhelming the WS
        if (!flushTimer) {
          flushTimer = setTimeout(() => {
            flushTimer = null;
            flushPending();
          }, FLUSH_INTERVAL_MS);
        }
      });

      res.on("end", () => {
        if (flushTimer) clearTimeout(flushTimer);
        flushPending();
      });

      res.on("error", (err: Error) => {
        if (!aborted) onError(err);
      });
    },
  );

  req.on("error", (err: Error) => {
    if (!aborted) onError(err);
  });

  req.end();
  currentReq = req;

  return () => {
    aborted = true;
    if (currentReq) {
      currentReq.destroy();
      currentReq = null;
    }
  };
}

// ─── WebSocket Server ─────────────────────────────────────────────────────

/**
 * WebSocket server for live container log streaming.
 *
 * Protocol:
 * - Client sends { action: "subscribe", containerId: "abc123", tail?: 200 }
 * - Server replies { type: "subscribed", containerId: "abc123" }
 * - Server streams { type: "lines", data: string[] } as new log lines arrive
 * - Client sends { action: "unsubscribe" } to stop
 * - Server sends { type: "error", message: "..." } on failure
 *
 * Only one subscription per client at a time. New subscribe replaces the old one.
 */
export function createContainerLogsWebSocket(
  _server: Server,
  logger: pino.Logger,
): WebSocketServer {
  const wss = new WebSocketServer({ noServer: true });
  const log = logger.child({ component: "container-logs-ws" });

  wss.on("connection", (ws: WebSocket) => {
    log.debug("Client connected");
    let stopFollowing: (() => void) | null = null;

    const cleanup = (): void => {
      if (stopFollowing) {
        stopFollowing();
        stopFollowing = null;
      }
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
        // Stop any existing subscription
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
          log,
        );

        sendJson(ws, { type: "subscribed", containerId });
      } else if (isUnsubscribeMessage(msg)) {
        cleanup();
      }
    });

    ws.on("close", () => {
      log.debug("Client disconnected");
      cleanup();
    });

    ws.on("error", (err: Error) => {
      log.warn({ err: err.message }, "WebSocket client error");
      cleanup();
    });
  });

  log.info("Container logs WebSocket server mounted at /ws/container-logs");
  return wss;
}
