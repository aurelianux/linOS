/** API endpoint paths served by dashboard-api */
export const API_ENDPOINTS = {
  SYSTEM_INFO: "/system/info",
  SYSTEM_VITALS: "/system/vitals",
  SYSTEM_CONTAINERS: "/system/containers",
  BERTA_METRICS: "/system/berta",
  SERVICES_STATUS: "/services/status",
  DASHBOARD_CONFIG: "/dashboard/config",
  MODE: "/mode",
  ADMIN_STACK_RESTART: "/admin/stack",
  ADMIN_CONTAINER: "/admin/container",
  ADMIN_GIT_PULL: "/admin/git-pull",
  ADMIN_GIT_STATUS: "/admin/git-status",
} as const;

/** Default polling interval for all data-fetching hooks */
export const POLL_INTERVAL_MS = 30_000;
