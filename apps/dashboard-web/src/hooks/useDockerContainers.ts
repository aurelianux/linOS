import { createPollingHook } from "./usePolledData";
import type { ContainersData } from "@/lib/api/types";

/**
 * Polls GET /api/system/containers every 30 seconds.
 * Returns { data, loading, error, lastUpdated, refresh }.
 * When Docker is unreachable, data.available is false (not an error).
 */
export const useDockerContainers = createPollingHook<ContainersData>("/system/containers");
