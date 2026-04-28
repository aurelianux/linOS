import { createPollingHook } from "./usePolledData";
import type { BertaData } from "@/lib/api/types";
import { API_ENDPOINTS } from "@/lib/api/endpoints";

/** Polls GET /api/system/berta every 30 seconds. */
export const useBertaMetrics = createPollingHook<BertaData>(
  API_ENDPOINTS.BERTA_METRICS,
  30_000
);
