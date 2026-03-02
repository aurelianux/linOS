import { useCallback, useEffect, useState } from "react";
import { fetchJson, ApiErrorException } from "../lib/api/client";
import type { HaState } from "../lib/api/types";

const POLL_INTERVAL_MS = 10_000;

interface UseHaStatesResult {
  states: HaState[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

/**
 * Fetches all Home Assistant entity states from the API.
 * Automatically polls every 10 seconds for live updates.
 */
export function useHaStates(): UseHaStatesResult {
  const [states, setStates] = useState<HaState[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<HaState[]>("/ha/states");
      setStates(data);
    } catch (err) {
      if (err instanceof ApiErrorException) {
        setError(err.message);
      } else {
        setError("Failed to load Home Assistant data");
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const id = setInterval(() => void refresh(), POLL_INTERVAL_MS);
    return () => clearInterval(id);
  }, [refresh]);

  return { states, loading, error, refresh };
}

interface UseHaServiceResult {
  callService: (
    domain: string,
    service: string,
    data?: Record<string, unknown>
  ) => Promise<void>;
  pending: boolean;
}

/**
 * Hook for calling a Home Assistant service (e.g. light.turn_on, switch.toggle).
 */
export function useHaService(): UseHaServiceResult {
  const [pending, setPending] = useState(false);

  const callService = useCallback(
    async (
      domain: string,
      service: string,
      data: Record<string, unknown> = {}
    ) => {
      setPending(true);
      try {
        await fetchJson<null>(`/ha/services/${domain}/${service}`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });
      } finally {
        setPending(false);
      }
    },
    []
  );

  return { callService, pending };
}
