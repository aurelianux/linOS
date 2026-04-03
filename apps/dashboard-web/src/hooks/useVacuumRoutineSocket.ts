import { useState, useEffect, useCallback, useRef } from "react";
import { fetchJson } from "@/lib/api/client";
import type { VacuumRoutineState } from "@/lib/api/types";

const RECONNECT_DELAY_MS = 3000;

function getWsUrl(): string {
  const apiBase = import.meta.env.VITE_API_BASE ?? "/api";
  // Derive WS URL from the API base
  // In dev: API is at http://localhost:4001, WS at ws://localhost:4001/ws/vacuum-routines
  // In prod: API is behind /api proxy, WS needs the same host
  const loc = window.location;
  const protocol = loc.protocol === "https:" ? "wss:" : "ws:";

  // If VITE_API_BASE is an absolute URL, parse it
  if (apiBase.startsWith("http")) {
    const url = new URL(apiBase);
    const wsProtocol = url.protocol === "https:" ? "wss:" : "ws:";
    return `${wsProtocol}//${url.host}/ws/vacuum-routines`;
  }

  // Relative path — same host
  return `${protocol}//${loc.host}/ws/vacuum-routines`;
}

export interface UseVacuumRoutineSocket {
  state: VacuumRoutineState | null;
  connected: boolean;
  start: (routineId: string, delayMs?: number) => Promise<void>;
  pause: () => Promise<void>;
  resume: () => Promise<void>;
  cancel: () => Promise<void>;
}

/**
 * WebSocket hook for real-time vacuum routine state.
 * Automatically reconnects on disconnect.
 * Provides start/pause/resume/cancel actions via REST (state updates come via WS).
 */
export function useVacuumRoutineSocket(): UseVacuumRoutineSocket {
  const [state, setState] = useState<VacuumRoutineState | null>(null);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
    };

    ws.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(String(event.data)) as VacuumRoutineState;
        setState(data);
      } catch {
        // Ignore malformed messages
      }
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;

      // Auto-reconnect
      reconnectTimerRef.current = setTimeout(() => {
        connect();
      }, RECONNECT_DELAY_MS);
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

  const start = useCallback(async (routineId: string, delayMs?: number) => {
    await fetchJson<VacuumRoutineState>("/vacuum-routines/" + routineId + "/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ delayMs }),
    });
    // State update comes via WebSocket
  }, []);

  const pause = useCallback(async () => {
    await fetchJson<VacuumRoutineState>("/vacuum-routines/current/pause", {
      method: "POST",
    });
    // State update comes via WebSocket
  }, []);

  const resume = useCallback(async () => {
    await fetchJson<VacuumRoutineState>("/vacuum-routines/current/resume", {
      method: "POST",
    });
    // State update comes via WebSocket
  }, []);

  const cancel = useCallback(async () => {
    await fetchJson<VacuumRoutineState>("/vacuum-routines/current/cancel", {
      method: "POST",
    });
    // State update comes via WebSocket
  }, []);

  return { state, connected, start, pause, resume, cancel };
}
