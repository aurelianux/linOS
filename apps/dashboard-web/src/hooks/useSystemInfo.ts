import { createPollingHook } from "./usePolledData";
import type { SystemInfo } from "@/lib/api/types";
import { API_ENDPOINTS } from "@/lib/api/endpoints";

/** Polls GET /api/system/info every 30 seconds. */
export const useSystemInfo = createPollingHook<SystemInfo>(API_ENDPOINTS.SYSTEM_INFO);
