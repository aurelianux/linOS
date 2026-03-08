import { createPollingHook } from "./usePolledData";
import type { ContainersData } from "@/lib/api/types";
import { API_ENDPOINTS } from "@/lib/api/endpoints";

/**
 * Polls GET /api/system/containers every 30 seconds.
 * When Docker is unreachable, data.available is false (not an error).
 */
export const useDockerContainers = createPollingHook<ContainersData>(API_ENDPOINTS.SYSTEM_CONTAINERS);
