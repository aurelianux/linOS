import { useState, useCallback, useRef } from "react";

interface UseOptimisticActionResult<T> {
  optimisticValue: T | null;
  execute: (optimistic: T, action: () => Promise<void>) => void;
  error: string | null;
  clearError: () => void;
}

/**
 * Manages optimistic state for async HA service calls.
 *
 * - Sets `optimisticValue` immediately on `execute()`
 * - On success: clears after `reconcileMs` to let WebSocket state arrive
 * - On error: reverts immediately, sets `error` (auto-clears after 3s)
 */
export function useOptimisticAction<T>(
  reconcileMs = 500
): UseOptimisticActionResult<T> {
  const [optimisticValue, setOptimisticValue] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const counterRef = useRef(0);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearError = useCallback(() => {
    setError(null);
    if (errorTimerRef.current) {
      clearTimeout(errorTimerRef.current);
      errorTimerRef.current = null;
    }
  }, []);

  const execute = useCallback(
    (optimistic: T, action: () => Promise<void>) => {
      const id = ++counterRef.current;
      setOptimisticValue(optimistic);
      clearError();

      action()
        .then(() => {
          setTimeout(() => {
            if (counterRef.current === id) {
              setOptimisticValue(null);
            }
          }, reconcileMs);
        })
        .catch((err: unknown) => {
          if (counterRef.current === id) {
            setOptimisticValue(null);
          }
          const message =
            err instanceof Error ? err.message : "Unknown error";
          setError(message);
          errorTimerRef.current = setTimeout(() => {
            setError(null);
            errorTimerRef.current = null;
          }, 3000);
        });
    },
    [reconcileMs, clearError]
  );

  return { optimisticValue, execute, error, clearError };
}
