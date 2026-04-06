import type { GitStatus } from "@/lib/api/types";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { createPollingHook } from "./usePolledData";

const GIT_STATUS_POLL_INTERVAL_MS = 60_000;

export const useGitStatus = createPollingHook<GitStatus>(
  API_ENDPOINTS.ADMIN_GIT_STATUS,
  GIT_STATUS_POLL_INTERVAL_MS,
);
