import { createPollingHook } from "./usePolledData";
import type { ServiceStatus } from "@/lib/api/types";
import { API_ENDPOINTS } from "@/lib/api/endpoints";

/** Polls GET /api/services/status every 30 seconds. */
export const useServiceStatuses = createPollingHook<ServiceStatus[]>(API_ENDPOINTS.SERVICES_STATUS);
