export const RING_SIZE = 160;
export const RING_STROKE = 6;
export const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export const QUICK_SET_MINUTES = [8, 10, 12, 15, 20, 30, 270] as const;
export const ONE_MINUTE_MS = 60_000;

export function formatTime(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

export function getRemainingMs(startedAt: number, durationMs: number): number {
  return Math.max(0, durationMs - (Date.now() - startedAt));
}

export function getRingColor(remainingMs: number): string {
  if (remainingMs > ONE_MINUTE_MS) return "text-emerald-400";
  if (remainingMs > ONE_MINUTE_MS / 2) return "text-amber-400";
  return "text-red-400";
}
