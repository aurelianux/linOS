import { useState, useEffect, useCallback, useRef } from "react";
import { fetchJson } from "@/lib/api/client";
import type { TimerState, TimerStartInput } from "@/lib/api/timer-types";

const RECONNECT_BASE_MS = 1000;
const RECONNECT_MAX_MS = 30000;

function getWsUrl(): string {
  const apiBase = import.meta.env.VITE_API_BASE ?? "/api";
  // Derive WS URL from the API base
  // In dev: API is at http://localhost:4001, WS at ws://localhost:4001/ws/timer
  // In prod: API is behind /api proxy, WS needs the same host
  const loc = window.location;
  const protocol = loc.protocol === "https:" ? "wss:" : "ws:";

  // If VITE_API_BASE is an absolute URL, parse it
  if (apiBase.startsWith("http")) {
    const url = new URL(apiBase);
    const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//${url.host}/ws/timer`;
  }

  // Relative path — same host
  return `${protocol}//${loc.host}/ws/timer`;
}

export interface UseTimerSocket {
  state: TimerState | null;
  connected: boolean;
  start: (input: TimerStartInput) => Promise<void>;
  stop: () => Promise<void>;
}

/**
 * WebSocket hook for real-time timer state.
 * Automatically reconnects on disconnect.
 * Provides start/stop actions via REST (state updates come via WS).
 */
export function useTimerSocket(): UseTimerSocket {
  const [state, setState] = useState<TimerState | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retriesRef = useRef(0);

  const connect = useCallback(() => {
    // Clean up previous
    if (wsRef.current) {
      wsRef.current.close();
      wsRef.current = null;
    }

    const url = getWsUrl();
    const ws = new WebSocket(url);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      retriesRef.current = 0;
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(String(event.data)) as TimerState;
        setState(data);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;

      // Exponential backoff reconnect
      const delay = Math.min(RECONNECT_BASE_MS * 2 ** retriesRef.current, RECONNECT_MAX_MS);
      retriesRef.current += 1;
      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, delay);
    };

    ws.onerror = () => {
      // onclose will fire after onerror, triggering reconnect
    };
  }, []);

  useEffect(() => {
    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [connect]);

  const start = useCallback(async (input: TimerStartInput) => {
    await fetchJson<TimerState>("/timer/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(input),
    });
    // State update comes via WebSocket
  }, []);

  const stop = useCallback(async () => {
    await fetchJson<TimerState>("/timer/stop", {
      method: "POST",
    });
    // State update comes via WebSocket
  }, []);

  return { state, connected, start, stop };
}
