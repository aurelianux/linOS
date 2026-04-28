import { type Request, type Response } from "express";
import { AppError, type ApiResponse } from "../middleware/errors.js";
import { dockerApiRequest, dockerApiRequestRaw, parseDockerLogs } from "./system.docker.js";
import { loadHostSshConfig, runGitPullViaSsh, runStackActionViaSsh, type GitPullResult, type StackAction } from "./admin.helpers.js";

interface ContainerRestartResult { name: string; success: boolean; }
interface ContainerLogsResult { logs: string; }
interface StackActionResult { projectName: string; action: StackAction; initiated: boolean; }

export type { ContainerRestartResult, ContainerLogsResult, GitPullResult, StackActionResult };

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

const VALID_ACTIONS = new Set<string>(["build", "up", "down"]);

export function handleStackAction(
  allowedProjects: Set<string>,
  getComposePath: (projectName: string) => string | undefined,
  getEnvFile: (projectName: string) => string | undefined,
) {
  return async (req: Request, res: Response): Promise<void> => {
    const rawParam = req.params.projectName;
    const projectName = Array.isArray(rawParam) ? rawParam[0] : rawParam;
    if (!projectName || !allowedProjects.has(projectName)) {
      throw new AppError(`Unknown stack: ${projectName ?? "undefined"}`, 400, "INVALID_STACK");
    }

    const rawAction = (req.body as Record<string, unknown>)?.action;
    if (typeof rawAction !== "string" || !VALID_ACTIONS.has(rawAction)) {
      throw new AppError(`Invalid action: ${String(rawAction ?? "undefined")}`, 400, "INVALID_ACTION");
    }
    const action = rawAction as StackAction;

    const composePath = getComposePath(projectName);
    if (!composePath) {
      throw new AppError(`No composePath configured for stack: ${projectName}`, 400, "MISSING_COMPOSE_PATH");
    }

    const config = loadHostSshConfig();
    await runStackActionViaSsh(config, { composePath, action, envFile: getEnvFile(projectName) });

    const data: StackActionResult = { projectName, action, initiated: action === "build" };
    res.json({ ok: true, data } satisfies ApiResponse<StackActionResult>);
  };
}
