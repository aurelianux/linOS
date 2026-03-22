/**
 * Timer state as returned by GET /timer/state and WebSocket broadcasts.
 */
export interface TimerState {
  running: boolean;
  startedAt: number | null;
  durationMs: number;
  label: string;
}

/** Payload for POST /timer/start */
export interface TimerStartInput {
  durationMs: number;
  label?: string;
}
