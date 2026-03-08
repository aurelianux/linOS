import { createPollingHook } from "./usePolledData";
import type { SystemInfo } from "@/lib/api/types";

/** Polls GET /api/system/info every 30 seconds. Returns { data, loading, error, lastUpdated, refresh }. */
export const useSystemInfo = createPollingHook<SystemInfo>("/system/info");
