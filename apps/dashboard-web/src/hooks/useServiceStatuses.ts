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
 * `loading` is true only during the initial fetch (no data yet).
 * Subsequent background polls update data silently to avoid UI flicker.
 */
export function useServiceStatuses(): UseServiceStatusesReturn {
  const [statuses, setStatuses] = useState<ServiceStatus[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Track whether we've received the first response so subsequent polls
  // don't re-trigger the full loading state.
  const hasData = useRef(false);

  const poll = useCallback(() => {
    if (!hasData.current) {
      setLoading(true);
    }

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
    poll();
    const id = setInterval(poll, POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [poll]);

  return { statuses, loading, error, lastUpdated, refresh: poll };
}
