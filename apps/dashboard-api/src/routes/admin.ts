import { execFile } from "child_process";
import { promisify } from "util";
import { Router, type Request, type Response } from "express";
import { type DashboardConfig } from "../config/app-config.js";
import { AppError, type ApiResponse } from "../middleware/errors.js";
import { dockerApiRequest } from "./system.js";

const execFileAsync = promisify(execFile);

const HOST_REPO_PATH = "/host-repo";

// ─── Response types ───────────────────────────────────────────────────────

interface StackRestartResult {
  restarted: string[];
  failed: string[];
}

interface GitPullResult {
  stdout: string;
  stderr: string;
}

interface GitStatusResult {
  branch: string;
  lastCommit: { hash: string; message: string; relativeTime: string };
  ahead: number;
  behind: number;
  dirty: number;
  untracked: number;
}

// ─── Docker helpers ───────────────────────────────────────────────────────

interface DockerApiContainer {
  Id: string;
  Names: string[];
}

async function getContainersByProject(
  projectName: string,
): Promise<DockerApiContainer[]> {
  const filters = JSON.stringify({
    label: [`com.docker.compose.project=${projectName}`],
  });
  return dockerApiRequest<DockerApiContainer[]>(
    `/containers/json?all=true&filters=${encodeURIComponent(filters)}`,
  );
}

// ─── Git helpers ──────────────────────────────────────────────────────────

async function runGit(...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync("git", ["-C", HOST_REPO_PATH, ...args], {
    timeout: 30_000,
    env: { ...process.env, LC_ALL: "C" },
  });
  return stdout.trim();
}

// ─── Router ───────────────────────────────────────────────────────────────

export function adminRouter(dashboardConfig: DashboardConfig): Router {
  const router = Router();

  const allowedProjects = new Set(
    (dashboardConfig.adminStacks ?? []).map((s) => s.projectName),
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

      const containers = await getContainersByProject(projectName);

      if (containers.length === 0) {
        throw new AppError(
          `No containers found for project "${projectName}"`,
          404,
          "NO_CONTAINERS",
        );
      }

      const restarted: string[] = [];
      const failed: string[] = [];

      await Promise.allSettled(
        containers.map(async (c) => {
          const name = (c.Names[0] ?? "").replace(/^\//, "");
          try {
            await dockerApiRequest<undefined>(
              `/containers/${c.Id}/restart?t=10`,
              "POST",
              30_000,
            );
            restarted.push(name);
          } catch {
            failed.push(name);
          }
        }),
      );

      const data: StackRestartResult = { restarted, failed };
      res.json({ ok: true, data } satisfies ApiResponse<StackRestartResult>);
    },
  );

  // POST /admin/git-pull
  router.post(
    "/admin/git-pull",
    async (_req: Request, res: Response): Promise<void> => {
      try {
        const { stdout, stderr } = await execFileAsync(
          "git",
          ["-C", HOST_REPO_PATH, "pull"],
          { timeout: 30_000, env: { ...process.env, LC_ALL: "C" } },
        );

        const data: GitPullResult = {
          stdout: stdout.trim(),
          stderr: stderr.trim(),
        };
        res.json({ ok: true, data } satisfies ApiResponse<GitPullResult>);
      } catch (err: unknown) {
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
