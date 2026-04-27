export const RECONNECT_BASE_MS = 1000;
export const RECONNECT_MAX_MS = 30000;
export const MAX_LOG_LINES = 1000;

export function getWsUrl(): string {
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

export type ServerMessage = LinesMessage | SubscribedMessage | ErrorMessage;

export interface UseContainerLogsSocket {
  lines: string[];
  connected: boolean;
  subscribedTo: string | null;
  error: string | null;
  subscribe: (containerId: string, tail?: number) => void;
  unsubscribe: () => void;
  clearLines: () => void;
}
