import { createPollingHook } from "./usePolledData";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { DashboardConfig } from "@/lib/api/types";

/** 5-minute poll — config changes rarely; no need to hammer the API */
const DASHBOARD_POLL_MS = 5 * 60 * 1_000;

export const useDashboardConfig = createPollingHook<DashboardConfig>(
  API_ENDPOINTS.DASHBOARD_CONFIG,
  DASHBOARD_POLL_MS
);
