import { execFile } from "child_process";
import { readFile } from "fs/promises";
import path from "path";
import { promisify } from "util";
import { Router, type Request, type Response } from "express";
import { Client, type ConnectConfig } from "ssh2";
import { type DashboardConfig } from "../config/app-config.js";
import { AppError, type ApiResponse } from "../middleware/errors.js";
import { dockerApiRequest, dockerApiRequestRaw, parseDockerLogs } from "./system.js";

const execFileAsync = promisify(execFile);

const HOST_REPO_PATH = "/host-repo";
const DEFAULT_LOCALE = "C";
const GIT_COMMAND = "git";
const DEFAULT_SSH_PORT = 22;
const DEFAULT_REMOTE_REPO_PATH = "/host-repo";
const SSH_READY_TIMEOUT_MS = 10_000;
const SSH_EXEC_TIMEOUT_MS = 30_000;

const ENV_SSH_HOST = "LINOS_GIT_PULL_SSH_HOST";
const ENV_SSH_PORT = "LINOS_GIT_PULL_SSH_PORT";
const ENV_SSH_USER = "LINOS_GIT_PULL_SSH_USER";
const ENV_SSH_PRIVATE_KEY_PATH = "LINOS_GIT_PULL_SSH_PRIVATE_KEY_PATH";
const ENV_SSH_PRIVATE_KEY_PASSPHRASE = "LINOS_GIT_PULL_SSH_PRIVATE_KEY_PASSPHRASE";
const ENV_REMOTE_REPO_PATH = "LINOS_GIT_PULL_REMOTE_REPO_PATH";

// ─── Response types ───────────────────────────────────────────────────────

interface StackRestartResult {
  restarted: string[];
  failed: string[];
}

interface ContainerRestartResult {
  name: string;
  success: boolean;
}

interface ContainerLogsResult {
  logs: string;
}

interface GitPullResult {
  stdout: string;
  stderr: string;
}

interface SshGitPullConfig {
  host: string;
  port: number;
  username: string;
  privateKeyPath: string;
  passphrase?: string;
  remoteRepoPath: string;
}

interface GitStatusResult {
  branch: string;
  lastCommit: { hash: string; message: string; relativeTime: string };
  ahead: number;
  behind: number;
  dirty: number;
  untracked: number;
}

// ─── Git helpers ──────────────────────────────────────────────────────────

async function runGit(...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(GIT_COMMAND, ["-C", HOST_REPO_PATH, ...args], {
    timeout: 30_000,
    env: { ...process.env, LC_ALL: DEFAULT_LOCALE },
  });
  return stdout.trim();
}

function parseSshPort(rawPort: string | undefined): number {
  if (!rawPort) return DEFAULT_SSH_PORT;
  const parsed = Number(rawPort);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(
      `${ENV_SSH_PORT} must be a positive integer`,
      500,
      "GIT_PULL_CONFIG_INVALID",
    );
  }
  return parsed;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new AppError(
      `Git pull SSH is not configured: missing ${name}`,
      500,
      "GIT_PULL_CONFIG_MISSING",
    );
  }
  return value;
}

function shellEscapeSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function loadSshGitPullConfig(): SshGitPullConfig {
  return {
    host: getRequiredEnv(ENV_SSH_HOST),
    port: parseSshPort(process.env[ENV_SSH_PORT]),
    username: getRequiredEnv(ENV_SSH_USER),
    privateKeyPath: getRequiredEnv(ENV_SSH_PRIVATE_KEY_PATH),
    passphrase: process.env[ENV_SSH_PRIVATE_KEY_PASSPHRASE]?.trim() || undefined,
    remoteRepoPath:
      process.env[ENV_REMOTE_REPO_PATH]?.trim() || DEFAULT_REMOTE_REPO_PATH,
  };
}

async function runGitPullViaSsh(config: SshGitPullConfig): Promise<GitPullResult> {
  const privateKey = await readFile(config.privateKeyPath, "utf-8");
  const command = `${GIT_COMMAND} -C ${shellEscapeSingleQuoted(config.remoteRepoPath)} pull`;

  return await new Promise<GitPullResult>((resolve, reject) => {
    const conn = new Client();
    let finished = false;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const finish = (result?: GitPullResult, err?: Error): void => {
      if (finished) return;
      finished = true;
      if (timeoutHandle) clearTimeout(timeoutHandle);
      conn.end();
      if (err) {
        reject(err);
        return;
      }
      if (!result) {
        reject(new Error("SSH command finished without result"));
        return;
      }
      resolve(result);
    };

    const connectConfig: ConnectConfig = {
      host: config.host,
      port: config.port,
      username: config.username,
      privateKey,
      passphrase: config.passphrase,
      readyTimeout: SSH_READY_TIMEOUT_MS,
    };

    conn.on("ready", () => {
      timeoutHandle = setTimeout(() => {
        finish(undefined, new Error("SSH command timed out"));
      }, SSH_EXEC_TIMEOUT_MS);

      conn.exec(command, (execError, stream) => {
        if (execError) {
          finish(undefined, execError);
          return;
        }

        let stdout = "";
        let stderr = "";

        stream.on("data", (chunk: Buffer) => {
          stdout += chunk.toString();
        });
        stream.stderr.on("data", (chunk: Buffer) => {
          stderr += chunk.toString();
        });
        stream.on("close", (code: number | null) => {
          if (code !== 0) {
            finish(
              undefined,
              new Error(`Remote git pull exited with code ${code ?? -1}: ${stderr.trim()}`),
            );
            return;
          }
          finish({ stdout: stdout.trim(), stderr: stderr.trim() });
        });
      });
    });

    conn.on("error", (err: Error) => {
      finish(undefined, err);
    });

    conn.connect(connectConfig);
  });
}

// ─── Router ───────────────────────────────────────────────────────────────

export function adminRouter(dashboardConfig: DashboardConfig): Router {
  const router = Router();

  const allowedProjects = new Set(
    (dashboardConfig.adminStacks ?? []).map((s) => s.projectName),
  );

  const composePathByProject = new Map(
    (dashboardConfig.adminStacks ?? [])
      .filter((s) => s.composePath)
      .map((s) => [s.projectName, path.join(HOST_REPO_PATH, s.composePath!)]),
  );

  // POST /admin/stack/:projectName/restart
  router.post(
    "/admin/stack/:projectName/restart",
    async (req: Request, res: Response): Promise<void> => {
      const rawParam = req.params.projectName;
      const projectName = Array.isArray(rawParam) ? rawParam[0] : rawParam;

      if (!projectName || !allowedProjects.has(projectName)) {
        throw new AppError(
          `Unknown stack: ${projectName ?? "undefined"}`,
          400,
          "INVALID_STACK",
        );
      }

      const composePath = composePathByProject.get(projectName);
      if (!composePath) {
        throw new AppError(
          `No composePath configured for stack: ${projectName}`,
          400,
          "MISSING_COMPOSE_PATH",
        );
      }

      try {
        await execFileAsync(
          "docker",
          ["compose", "up", "--build", "-d"],
          { cwd: composePath, timeout: 300_000 },
        );
        const data: StackRestartResult = { restarted: [projectName], failed: [] };
        res.json({ ok: true, data } satisfies ApiResponse<StackRestartResult>);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new AppError(`Stack rebuild failed: ${msg}`, 500, "STACK_REBUILD_FAILED");
      }
    },
  );

  // POST /admin/container/:containerId/restart
  router.post(
    "/admin/container/:containerId/restart",
    async (req: Request, res: Response): Promise<void> => {
      const rawParam = req.params.containerId;
      const containerId = Array.isArray(rawParam) ? rawParam[0] : rawParam;

      if (!containerId) {
        throw new AppError("Missing container ID", 400, "INVALID_CONTAINER");
      }

      try {
        await dockerApiRequest<undefined>(
          `/containers/${containerId}/restart?t=10`,
          "POST",
          30_000,
        );
        const data: ContainerRestartResult = { name: containerId, success: true };
        res.json({ ok: true, data } satisfies ApiResponse<ContainerRestartResult>);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new AppError(
          `Failed to restart container: ${msg}`,
          500,
          "CONTAINER_RESTART_FAILED",
        );
      }
    },
  );

  // GET /admin/container/:containerId/logs
  router.get(
    "/admin/container/:containerId/logs",
    async (req: Request, res: Response): Promise<void> => {
      const rawParam = req.params.containerId;
      const containerId = Array.isArray(rawParam) ? rawParam[0] : rawParam;

      if (!containerId) {
        throw new AppError("Missing container ID", 400, "INVALID_CONTAINER");
      }

      try {
        const raw = await dockerApiRequestRaw(
          `/containers/${containerId}/logs?stdout=1&stderr=1&timestamps=1&tail=200`,
          "GET",
          10_000,
        );
        const logs = parseDockerLogs(raw);
        const data: ContainerLogsResult = { logs };
        res.json({ ok: true, data } satisfies ApiResponse<ContainerLogsResult>);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new AppError(
          `Failed to fetch logs: ${msg}`,
          500,
          "CONTAINER_LOGS_FAILED",
        );
      }
    },
  );

  // POST /admin/git-pull
  router.post(
    "/admin/git-pull",
    async (_req: Request, res: Response): Promise<void> => {
      try {
        const config = loadSshGitPullConfig();
        const data = await runGitPullViaSsh(config);
        res.json({ ok: true, data } satisfies ApiResponse<GitPullResult>);
      } catch (err: unknown) {
        if (err instanceof AppError) throw err;
        const msg = err instanceof Error ? err.message : String(err);
        throw new AppError(`Git pull failed: ${msg}`, 500, "GIT_PULL_FAILED");
      }
    },
  );

  // GET /admin/git-status
  router.get(
    "/admin/git-status",
    async (_req: Request, res: Response): Promise<void> => {
      try {
        const [branch, commitLine, porcelain, revList] = await Promise.all([
          runGit("rev-parse", "--abbrev-ref", "HEAD"),
          runGit("log", "-1", "--format=%h\t%s\t%ar"),
          runGit("status", "--porcelain").catch(() => ""),
          runGit("rev-list", "--count", "--left-right", "HEAD...@{upstream}").catch(
            () => "0\t0",
          ),
        ]);

        const [hash = "", message = "", relativeTime = ""] =
          commitLine.split("\t");

        const lines = porcelain ? porcelain.split("\n") : [];
        const dirty = lines.filter((l) => !l.startsWith("??")).length;
        const untracked = lines.filter((l) => l.startsWith("??")).length;

        const [aheadStr = "0", behindStr = "0"] = revList.split("\t");

        const data: GitStatusResult = {
          branch,
          lastCommit: { hash, message, relativeTime },
          ahead: Number(aheadStr),
          behind: Number(behindStr),
          dirty,
          untracked,
        };

        res.json({ ok: true, data } satisfies ApiResponse<GitStatusResult>);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        throw new AppError(
          `Git status failed: ${msg}`,
          500,
          "GIT_STATUS_FAILED",
        );
      }
    },
  );

  return router;
}
