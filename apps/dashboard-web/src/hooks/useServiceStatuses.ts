import { createPollingHook } from "./usePolledData";
import type { ServiceStatus } from "@/lib/api/types";

/** Polls GET /api/services/status every 30 seconds. Returns { data, loading, error, lastUpdated, refresh }. */
export const useServiceStatuses = createPollingHook<ServiceStatus[]>("/services/status");
