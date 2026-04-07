import { createPollingHook } from "./usePolledData";
import type { ContainersData } from "@/lib/api/types";
import { API_ENDPOINTS } from "@/lib/api/endpoints";

/** 60s is enough — container state rarely changes, and the admin page is not always visible */
const CONTAINER_POLL_INTERVAL_MS = 60_000;

/**
 * Polls GET /api/system/containers every 60 seconds.
 * When Docker is unreachable, data.available is false (not an error).
 */
export const useDockerContainers = createPollingHook<ContainersData>(
  API_ENDPOINTS.SYSTEM_CONTAINERS,
  CONTAINER_POLL_INTERVAL_MS,
);
