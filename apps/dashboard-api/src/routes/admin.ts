import path from "path";
import { Router } from "express";
import type pino from "pino";
import { type DashboardConfig } from "../config/app-config.js";
import { AppError, type ApiResponse } from "../middleware/errors.js";
import { fetchGitStatus, type GitStatusResult } from "./admin.helpers.js";
import {
  handleContainerRestart,
  handleContainerLogs,
  handleGitPull,
  handleStackRestart,
  handleBuildStatus,
} from "./admin.handlers.js";

export function adminRouter(dashboardConfig: DashboardConfig, logger?: pino.Logger): Router {
  const router = Router();

  const allowedProjects = new Set(
    (dashboardConfig.adminStacks ?? []).map((s) => s.projectName),
  );

  const hostComposePath = (projectName: string, remoteRepoPath: string): string | null => {
    const stack = (dashboardConfig.adminStacks ?? []).find((s) => s.projectName === projectName);
    if (!stack?.composePath) return null;
    return path.posix.join(remoteRepoPath, stack.composePath, "docker-compose.yml");
  };

  router.post(
    "/admin/stack/:projectName/restart",
    handleStackRestart(allowedProjects, hostComposePath),
  );

  router.get(
    "/admin/stack/:projectName/build-status",
    handleBuildStatus(allowedProjects, logger),
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
