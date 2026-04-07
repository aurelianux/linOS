import { useState, useEffect, useCallback, useRef } from "react";

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;
/** Keep only this many lines in the buffer to avoid memory issues */
const MAX_LOG_LINES = 1000;

function getWsUrl(): string {
  const apiBase = import.meta.env.VITE_API_BASE ?? "/api";
  const loc = window.location;
  const protocol = loc.protocol === "https:" ? "wss:" : "ws:";

  if (apiBase.startsWith("http")) {
    const url = new URL(apiBase);
    const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//${url.host}/ws/container-logs`;
  }

  return `${protocol}//${loc.host}/ws/container-logs`;
}

// ─── Types ────────────────────────────────────────────────────────────────

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

export interface UseContainerLogsSocket {
  /** Current log lines */
  lines: string[];
  /** Whether the WebSocket is connected */
  connected: boolean;
  /** Currently subscribed container ID (null if not subscribed) */
  subscribedTo: string | null;
  /** Last error message from the server */
  error: string | null;
  /** Subscribe to a container's logs */
  subscribe: (containerId: string, tail?: number) => void;
  /** Unsubscribe from the current container */
  unsubscribe: () => void;
  /** Clear the current log buffer */
  clearLines: () => void;
}

/**
 * WebSocket hook for live container log streaming.
 * Connects to /ws/container-logs, allows subscribing to one container at a time.
 * Automatically reconnects on disconnect and re-subscribes.
 */
export function useContainerLogsSocket(): UseContainerLogsSocket {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [subscribedTo, setSubscribedTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);
  // Track desired subscription so we can re-subscribe after reconnect
  const desiredContainerRef = useRef<string | null>(null);
  const desiredTailRef = useRef<number>(200);

  const sendSubscribe = useCallback((containerId: string, tail: number) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "subscribe", containerId, tail }));
    }
  }, []);

  // Use a ref for the connect function so the reconnect setTimeout
  // can reference it without triggering the react-hooks/immutability lint rule
  const connectRef = useRef<() => void>(() => {});

  const connect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const url = getWsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setError(null);
      retriesRef.current = 0;

      // Re-subscribe if we had an active subscription before reconnect
      if (desiredContainerRef.current) {
        sendSubscribe(desiredContainerRef.current, desiredTailRef.current);
      }
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const msg = JSON.parse(String(event.data)) as ServerMessage;

        if (msg.type === "lines") {
          setLines((prev) => {
            const combined = [...prev, ...msg.data];
            return combined.length > MAX_LOG_LINES
              ? combined.slice(combined.length - MAX_LOG_LINES)
              : combined;
          });
        } else if (msg.type === "subscribed") {
          setSubscribedTo(msg.containerId);
          setError(null);
        } else if (msg.type === "error") {
          setError(msg.message);
        }
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;

      const delay = Math.min(
        RECONNECT_BASE_MS * 2 ** retriesRef.current,
        RECONNECT_MAX_MS,
      );
      retriesRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => connectRef.current(), delay);
    };

    ws.onerror = () => {
      // onclose fires after onerror, triggering reconnect
    };
  }, [sendSubscribe]);

  // Keep connectRef in sync so reconnect timeout uses latest version
  useEffect(() => {
    connectRef.current = connect;
  }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const subscribe = useCallback(
    (containerId: string, tail = 200) => {
      desiredContainerRef.current = containerId;
      desiredTailRef.current = tail;
      setLines([]);
      setError(null);
      sendSubscribe(containerId, tail);
    },
    [sendSubscribe],
  );

  const unsubscribe = useCallback(() => {
    desiredContainerRef.current = null;
    setSubscribedTo(null);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "unsubscribe" }));
    }
  }, []);

  const clearLines = useCallback(() => {
    setLines([]);
  }, []);

  return { lines, connected, subscribedTo, error, subscribe, unsubscribe, clearLines };
}
