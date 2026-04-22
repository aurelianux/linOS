import { createPollingHook } from "./usePolledData";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { ModeState } from "@/lib/api/types";

/** Polls GET /mode every 30 s and returns current lighting mode per room. */
export const useLightingModes = createPollingHook<ModeState>(API_ENDPOINTS.MODE);
