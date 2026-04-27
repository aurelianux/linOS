import { useState, useEffect, useCallback, useRef } from "react";
import {
  RECONNECT_BASE_MS,
  RECONNECT_MAX_MS,
  MAX_LOG_LINES,
  getWsUrl,
  type ServerMessage,
  type UseContainerLogsSocket,
} from "./useContainerLogsSocket.helpers.js";

export type { UseContainerLogsSocket };

export function useContainerLogsSocket(): UseContainerLogsSocket {
  const [lines, setLines] = useState<string[]>([]);
  const [connected, setConnected] = useState(false);
  const [subscribedTo, setSubscribedTo] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);
  const desiredContainerRef = useRef<string | null>(null);
  const desiredTailRef = useRef<number>(200);

  const sendSubscribe = useCallback((containerId: string, tail: number) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "subscribe", containerId, tail }));
    }
  }, []);

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
        // ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** retriesRef.current, RECONNECT_MAX_MS);
      retriesRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => connectRef.current(), delay);
    };

    ws.onerror = () => {};
  }, [sendSubscribe]);

  useEffect(() => { connectRef.current = connect; }, [connect]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimerRef.current) clearTimeout(reconnectTimerRef.current);
      if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    };
  }, [connect]);

  const subscribe = useCallback((containerId: string, tail = 200) => {
    desiredContainerRef.current = containerId;
    desiredTailRef.current = tail;
    setLines([]);
    setError(null);
    sendSubscribe(containerId, tail);
  }, [sendSubscribe]);

  const unsubscribe = useCallback(() => {
    desiredContainerRef.current = null;
    setSubscribedTo(null);
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ action: "unsubscribe" }));
    }
  }, []);

  const clearLines = useCallback(() => { setLines([]); }, []);

  return { lines, connected, subscribedTo, error, subscribe, unsubscribe, clearLines };
}
