import { type Request, type Response } from "express";
import type pino from "pino";
import { AppError, type ApiResponse } from "../middleware/errors.js";
import { dockerApiRequest, dockerApiRequestRaw, parseDockerLogs } from "./system.docker.js";
import { loadHostSshConfig, runGitPullViaSsh, type GitPullResult } from "./admin.helpers.js";
import { launchStackBuildViaSsh, type StackBuildStartResult } from "./admin.build.js";
import { readBuildStatus, isSafeBuildId, type StackBuildStatusResult } from "./admin.status.js";

interface ContainerRestartResult { name: string; success: boolean; }
interface ContainerLogsResult { logs: string; }

export type { ContainerRestartResult, ContainerLogsResult, GitPullResult, StackBuildStartResult, StackBuildStatusResult };

export function handleContainerRestart() {
  return async (req: Request, res: Response): Promise<void> => {
    const rawParam = req.params.containerId;
    const containerId = Array.isArray(rawParam) ? rawParam[0] : rawParam;
    if (!containerId) throw new AppError("Missing container ID", 400, "INVALID_CONTAINER");
    try {
      await dockerApiRequest<undefined>(`/containers/${containerId}/restart?t=10`, "POST", 30_000);
      const data: ContainerRestartResult = { name: containerId, success: true };
      res.json({ ok: true, data } satisfies ApiResponse<ContainerRestartResult>);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError(`Failed to restart container: ${msg}`, 500, "CONTAINER_RESTART_FAILED");
    }
  };
}

export function handleContainerLogs() {
  return async (req: Request, res: Response): Promise<void> => {
    const rawParam = req.params.containerId;
    const containerId = Array.isArray(rawParam) ? rawParam[0] : rawParam;
    if (!containerId) throw new AppError("Missing container ID", 400, "INVALID_CONTAINER");
    try {
      const raw = await dockerApiRequestRaw(
        `/containers/${containerId}/logs?stdout=1&stderr=1&timestamps=1&tail=200`,
        "GET",
        10_000,
      );
      const data: ContainerLogsResult = { logs: parseDockerLogs(raw) };
      res.json({ ok: true, data } satisfies ApiResponse<ContainerLogsResult>);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError(`Failed to fetch logs: ${msg}`, 500, "CONTAINER_LOGS_FAILED");
    }
  };
}

export function handleGitPull() {
  return async (_req: Request, res: Response): Promise<void> => {
    try {
      const config = loadHostSshConfig();
      const data = await runGitPullViaSsh(config);
      res.json({ ok: true, data } satisfies ApiResponse<GitPullResult>);
    } catch (err: unknown) {
      if (err instanceof AppError) throw err;
      const msg = err instanceof Error ? err.message : String(err);
      throw new AppError(`Git pull failed: ${msg}`, 500, "GIT_PULL_FAILED");
    }
  };
}

export function handleStackRestart(
  allowedProjects: Set<string>,
  hostComposePath: (projectName: string, remoteRepoPath: string) => string | null,
) {
  return async (req: Request, res: Response): Promise<void> => {
    const rawParam = req.params.projectName;
    const projectName = Array.isArray(rawParam) ? rawParam[0] : rawParam;
    if (!projectName || !allowedProjects.has(projectName)) {
      throw new AppError(`Unknown stack: ${projectName ?? "undefined"}`, 400, "INVALID_STACK");
    }
    const config = loadHostSshConfig();
    const composeFilePath = hostComposePath(projectName, config.remoteRepoPath);
    if (!composeFilePath) {
      throw new AppError(`No composePath configured for stack: ${projectName}`, 400, "MISSING_COMPOSE_PATH");
    }
    const launch = await launchStackBuildViaSsh({ config, projectName, composeFilePath });
    const data: StackBuildStartResult = {
      projectName,
      buildId: launch.buildId,
      pid: launch.pid,
      logPath: launch.logPath,
      startedAt: launch.startedAt,
      commitHash: launch.commitHash,
    };
    res.json({ ok: true, data } satisfies ApiResponse<StackBuildStartResult>);
  };
}

export function handleBuildStatus(allowedProjects: Set<string>, logger?: pino.Logger) {
  return async (req: Request, res: Response): Promise<void> => {
    const rawParam = req.params.projectName;
    const projectName = Array.isArray(rawParam) ? rawParam[0] : rawParam;
    if (!projectName || !allowedProjects.has(projectName)) {
      throw new AppError(`Unknown stack: ${projectName ?? "undefined"}`, 400, "INVALID_STACK");
    }
    const rawBuildId = req.query.buildId;
    const buildId =
      typeof rawBuildId === "string" ? rawBuildId
      : Array.isArray(rawBuildId) ? String(rawBuildId[0])
      : "";
    if (!buildId || !isSafeBuildId(buildId)) {
      throw new AppError("Missing or invalid buildId", 400, "INVALID_BUILD_ID");
    }
    if (!buildId.endsWith(`-${projectName}`)) {
      throw new AppError(`buildId does not belong to stack ${projectName}`, 400, "INVALID_BUILD_ID");
    }
    const data = await readBuildStatus(buildId, logger);
    res.json({ ok: true, data } satisfies ApiResponse<StackBuildStatusResult>);
  };
}
