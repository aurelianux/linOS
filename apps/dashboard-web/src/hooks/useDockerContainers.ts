import { useState, useEffect, useCallback, useRef } from "react";
import { fetchJson, ApiErrorException } from "@/lib/api/client";
import type { ContainersData } from "@/lib/api/types";

/** Re-fetch container list every 30 seconds */
const POLL_INTERVAL_MS = 30_000;

export interface UseDockerContainersReturn {
  data: ContainersData | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

/**
 * Fetches and polls GET /api/system/containers every 30 seconds.
 *
 * `loading` is true only until the first response arrives.
 * Subsequent background polls update data silently to avoid UI flicker.
 *
 * When Docker is not accessible the API still returns ok:true with
 * data.available=false — the hook surfaces this to the consumer via `data`.
 */
export function useDockerContainers(): UseDockerContainersReturn {
  const [data, setData] = useState<ContainersData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const hasData = useRef(false);

  const fetchOnce = useCallback(() => {
    fetchJson<ContainersData>("/system/containers")
      .then((result) => {
        hasData.current = true;
        setData(result);
        setError(null);
        setLastUpdated(new Date());
      })
      .catch((err: unknown) => {
        setError(
          err instanceof ApiErrorException
            ? err.message
            : "Failed to load container list"
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

  const refresh = useCallback(() => {
    if (hasData.current) {
      setLoading(false);
    }
    fetchOnce();
  }, [fetchOnce]);

  return { data, loading, error, lastUpdated, refresh };
}
