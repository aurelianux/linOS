import { useState, useEffect, useCallback, useRef } from "react";
import { fetchJson, ApiErrorException } from "@/lib/api/client";
import type { ServiceStatus } from "@/lib/api/types";

/** Re-probe all services every 30 seconds */
const POLL_INTERVAL_MS = 30_000;

export interface UseServiceStatusesReturn {
  statuses: ServiceStatus[] | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

/**
 * Fetches and polls GET /api/services/status every 30 seconds.
 *
 * `loading` is true only until the first response arrives (initial state).
 * Subsequent background polls update data silently to avoid UI flicker.
 */
export function useServiceStatuses(): UseServiceStatusesReturn {
  const [statuses, setStatuses] = useState<ServiceStatus[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const hasData = useRef(false);

  // fetchOnce wraps the async fetch; setLoading(true) is never called
  // synchronously inside the effect – only setLoading(false) fires in .finally()
  // which is always asynchronous.
  const fetchOnce = useCallback(() => {
    fetchJson<ServiceStatus[]>("/services/status")
      .then((data) => {
        hasData.current = true;
        setStatuses(data);
        setError(null);
        setLastUpdated(new Date());
      })
      .catch((err: unknown) => {
        setError(
          err instanceof ApiErrorException
            ? err.message
            : "Failed to load service statuses"
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchOnce();
    const id = setInterval(fetchOnce, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [fetchOnce]);

  // For manual refresh: show loading only if we already have data
  const refresh = useCallback(() => {
    if (hasData.current) {
      setLoading(false); // keep showing stale data while refreshing
    }
    fetchOnce();
  }, [fetchOnce]);

  return { statuses, loading, error, lastUpdated, refresh };
}
