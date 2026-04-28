import http from "http";
import { DOCKER_SOCKET, parseDockerLogs } from "../routes/system.docker.js";

const FLUSH_INTERVAL_MS = 250;

/**
 * Follows Docker container logs in real-time via the Engine API stream.
 * Returns an abort function to stop following.
 */
export function followContainerLogs(
  containerId: string,
  tail: number,
  onLines: (lines: string[]) => void,
  onError: (err: Error) => void,
): () => void {
  let aborted = false;
  let currentReq: http.ClientRequest | null = null;

  const logPath = `/containers/${containerId}/logs?stdout=1&stderr=1&timestamps=1&follow=1&tail=${tail}`;

  const req = http.request(
    { socketPath: DOCKER_SOCKET, path: logPath, method: "GET" },
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

      let pendingBuffer = Buffer.alloc(0);
      let flushTimer: ReturnType<typeof setTimeout> | null = null;

      const flushPending = (): void => {
        if (pendingBuffer.length === 0) return;
        const text = parseDockerLogs(pendingBuffer);
        pendingBuffer = Buffer.alloc(0);
        if (text.length > 0) {
          const lines = text.split("\n").filter((l) => l.length > 0);
          if (lines.length > 0) onLines(lines);
        }
      };

      res.on("data", (chunk: Buffer) => {
        if (aborted) return;
        pendingBuffer = Buffer.concat([pendingBuffer, chunk]);
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
