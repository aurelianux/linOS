import { useState, useEffect, useCallback, useRef } from "react";
import { fetchJson, ApiErrorException } from "@/lib/api/client";
import type { SystemInfo } from "@/lib/api/types";

/** Re-fetch system info every 30 seconds */
const POLL_INTERVAL_MS = 30_000;

export interface UseSystemInfoReturn {
  info: SystemInfo | null;
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
  refresh: () => void;
}

/**
 * Fetches and polls GET /api/system/info every 30 seconds.
 *
 * `loading` is true only until the first response arrives.
 * Subsequent background polls update data silently to avoid UI flicker.
 */
export function useSystemInfo(): UseSystemInfoReturn {
  const [info, setInfo] = useState<SystemInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const hasData = useRef(false);

  const fetchOnce = useCallback(() => {
    fetchJson<SystemInfo>("/system/info")
      .then((data) => {
        hasData.current = true;
        setInfo(data);
        setError(null);
        setLastUpdated(new Date());
      })
      .catch((err: unknown) => {
        setError(
          err instanceof ApiErrorException
            ? err.message
            : "Failed to load system info"
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

  return { info, loading, error, lastUpdated, refresh };
}
