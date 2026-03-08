import { useState, useEffect, useCallback, useRef } from "react";
import { fetchJson, ApiErrorException } from "@/lib/api/client";

export interface PolledDataState<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

/**
 * Factory that creates a polling hook for a given API endpoint.
 * Use this instead of copy-pasting the same fetch/poll/error logic per endpoint.
 *
 * `loading` is true only on the first fetch. Subsequent background polls update
 * `data` silently so the UI doesn't flicker on refresh.
 *
 * Usage:
 *   export const useSystemInfo = createPollingHook<SystemInfo>("/system/info");
 *   export const useDockerContainers = createPollingHook<ContainersData>("/system/containers");
 */
export function createPollingHook<T>(url: string, intervalMs = 30_000) {
  return function usePolledData(): PolledDataState<T> {
    const [data, setData] = useState<T | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
    const hasData = useRef(false);

    const fetchOnce = useCallback(() => {
      fetchJson<T>(url)
        .then((d) => {
          hasData.current = true;
          setData(d);
          setError(null);
          setLastUpdated(new Date());
        })
        .catch((err: unknown) => {
          setError(
            err instanceof ApiErrorException ? err.message : `Failed to load ${url}`
          );
        })
        .finally(() => setLoading(false));
    }, []);

    useEffect(() => {
      fetchOnce();
      const id = setInterval(fetchOnce, intervalMs);
      return () => clearInterval(id);
    }, [fetchOnce]);

    const refresh = useCallback(() => {
      if (!hasData.current) setLoading(true);
      fetchOnce();
    }, [fetchOnce]);

    return { data, loading, error, lastUpdated, refresh };
  };
}
