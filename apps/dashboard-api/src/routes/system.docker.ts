import http from "http";

export const DOCKER_SOCKET = "/var/run/docker.sock";

/**
 * Make an HTTP request to the Docker Engine API via the Unix socket.
 * Returns the parsed JSON response body.
 */
export function dockerApiRequest<T>(
  path: string,
  method: "GET" | "POST" = "GET",
  timeoutMs = 5000,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath: DOCKER_SOCKET, path, method, timeout: timeoutMs },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString();
          if (!res.statusCode || res.statusCode >= 400) {
            reject(new Error(`Docker API ${res.statusCode}: ${body}`));
            return;
          }
          if (res.statusCode === 204 || body.length === 0) {
            resolve(undefined as T);
            return;
          }
          try {
            resolve(JSON.parse(body) as T);
          } catch {
            reject(new Error(`Failed to parse Docker API response: ${body.slice(0, 200)}`));
          }
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Docker API request timed out"));
    });
    req.end();
  });
}

/**
 * Make an HTTP request to the Docker Engine API via the Unix socket.
 * Returns the raw response Buffer without JSON parsing.
 * Use this for endpoints that return binary/stream data (e.g. container logs).
 */
export function dockerApiRequestRaw(
  path: string,
  method: "GET" | "POST" = "GET",
  timeoutMs = 5000,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const req = http.request(
      { socketPath: DOCKER_SOCKET, path, method, timeout: timeoutMs },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          if (!res.statusCode || res.statusCode >= 400) {
            reject(new Error(`Docker API ${res.statusCode}: ${body.toString().slice(0, 200)}`));
            return;
          }
          resolve(body);
        });
      },
    );
    req.on("error", reject);
    req.on("timeout", () => {
      req.destroy();
      reject(new Error("Docker API request timed out"));
    });
    req.end();
  });
}

const DOCKER_LOG_FRAME_HEADER_SIZE = 8;

/**
 * Parse Docker multiplexed log stream into plain text.
 * Docker logs API returns frames: [stream_type:1][padding:3][size:4][payload].
 * Falls back to raw string if no valid frames are detected (TTY mode).
 */
export function parseDockerLogs(buffer: Buffer): string {
  if (buffer.length === 0) return "";

  const lines: string[] = [];
  let offset = 0;

  while (offset + DOCKER_LOG_FRAME_HEADER_SIZE <= buffer.length) {
    const streamType = buffer[offset];
    if (streamType === undefined || streamType > 2) break;

    const payloadSize = buffer.readUInt32BE(offset + 4);
    offset += DOCKER_LOG_FRAME_HEADER_SIZE;

    if (offset + payloadSize > buffer.length) break;

    lines.push(buffer.subarray(offset, offset + payloadSize).toString("utf-8"));
    offset += payloadSize;
  }

  if (lines.length === 0 && buffer.length > 0) {
    return buffer.toString("utf-8");
  }

  return lines.join("");
}
