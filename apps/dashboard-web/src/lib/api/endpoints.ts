/** API endpoint paths served by dashboard-api */
export const API_ENDPOINTS = {
  SYSTEM_INFO: "/system/info",
  SYSTEM_VITALS: "/system/vitals",
  SYSTEM_CONTAINERS: "/system/containers",
  SERVICES_STATUS: "/services/status",
  DASHBOARD_CONFIG: "/dashboard/config",
  ADMIN_STACK_RESTART: "/admin/stack",
  ADMIN_GIT_PULL: "/admin/git-pull",
  ADMIN_GIT_STATUS: "/admin/git-status",
} as const;

/** Default polling interval for all data-fetching hooks */
export const POLL_INTERVAL_MS = 30_000;
