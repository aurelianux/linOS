import { useState } from "react";

/**
 * Accumulates numeric values into a fixed-size history buffer.
 * Returns the history array for sparkline rendering.
 *
 * Uses the "adjusting state during render" pattern (no effects needed):
 * https://react.dev/reference/react/useState#storing-information-from-previous-renders
 *
 * @param value - current metric value (null values are skipped)
 * @param maxPoints - max data points to keep (default 30 → 2.5 min at 5s intervals)
 */
export function useMetricHistory(
  value: number | null,
  maxPoints = 30
): number[] {
  const [history, setHistory] = useState<number[]>([]);
  const [prevValue, setPrevValue] = useState<number | null>(null);

  if (value !== null && value !== prevValue) {
    setPrevValue(value);
    setHistory((prev) => {
      const next = prev.length >= maxPoints ? prev.slice(1) : [...prev];
      next.push(value);
      return next;
    });
  }

  return history;
}
