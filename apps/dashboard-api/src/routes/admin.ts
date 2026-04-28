import { Router } from "express";
import { type DashboardConfig } from "../config/app-config.js";
import { AppError, type ApiResponse } from "../middleware/errors.js";
import { fetchGitStatus, type GitStatusResult } from "./admin.helpers.js";
import {
  handleContainerRestart,
  handleContainerLogs,
  handleGitPull,
  handleStackAction,
} from "./admin.handlers.js";

export function adminRouter(dashboardConfig: DashboardConfig): Router {
  const router = Router();

  const allowedProjects = new Set(
    (dashboardConfig.adminStacks ?? []).map((s) => s.projectName),
  );

  const getComposePath = (projectName: string): string | undefined =>
    (dashboardConfig.adminStacks ?? []).find((s) => s.projectName === projectName)?.composePath;

  const getEnvFile = (projectName: string): string | undefined =>
    (dashboardConfig.adminStacks ?? []).find((s) => s.projectName === projectName)?.envFile;

  router.post(
    "/admin/stack/:projectName/action",
    handleStackAction(allowedProjects, getComposePath, getEnvFile),
  );

  router.post("/admin/container/:containerId/restart", handleContainerRestart());

  router.get("/admin/container/:containerId/logs", handleContainerLogs());

  router.post("/admin/git-pull", handleGitPull());

  router.get(
    "/admin/git-status",
    async (_req, res): Promise<void> => {
      try {
        const data: GitStatusResult = await fetchGitStatus();
        res.json({ ok: true, data } satisfies ApiResponse<GitStatusResult>);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new AppError(`Git status failed: ${msg}`, 500, "GIT_STATUS_FAILED");
      }
    },
  );

  return router;
}
