import { createPollingHook } from "./usePolledData";
import type { SystemVitals } from "@/lib/api/types";
import { API_ENDPOINTS } from "@/lib/api/endpoints";

/** Polls GET /api/system/vitals every 5 seconds. */
export const useSystemVitals = createPollingHook<SystemVitals>(
  API_ENDPOINTS.SYSTEM_VITALS,
  5_000
);
