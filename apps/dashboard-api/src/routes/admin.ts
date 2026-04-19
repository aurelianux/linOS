import { execFile } from "child_process";
import { readFile, stat } from "fs/promises";
import path from "path";
import { promisify } from "util";
import { Router, type Request, type Response } from "express";
import { Client, type ConnectConfig } from "ssh2";
import type pino from "pino";
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
const BUILD_LOCK_EXIT_CODE = 75;
const BUILD_STATUS_TAIL_LINES = 40;
/** A build is considered stalled if its log file hasn't been written to in this long. */
const BUILD_STALL_MS = 15 * 60_000;

const ENV_SSH_HOST = "LINOS_GIT_PULL_SSH_HOST";
const ENV_SSH_PORT = "LINOS_GIT_PULL_SSH_PORT";
const ENV_SSH_USER = "LINOS_GIT_PULL_SSH_USER";
const ENV_SSH_PRIVATE_KEY_PATH = "LINOS_GIT_PULL_SSH_PRIVATE_KEY_PATH";
const ENV_SSH_PRIVATE_KEY_PASSPHRASE = "LINOS_GIT_PULL_SSH_PRIVATE_KEY_PASSPHRASE";
const ENV_REMOTE_REPO_PATH = "LINOS_GIT_PULL_REMOTE_REPO_PATH";

const BUILD_START_MARKER = "__BUILD_START__";
const BUILD_OK_MARKER = "__BUILD_OK__";
const BUILD_FAIL_MARKER = "__BUILD_FAIL__";

// ─── Response types ───────────────────────────────────────────────────────

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

/** Envelope for host SSH access. Env var names retain the `GIT_PULL` prefix for back-compat. */
interface HostSshConfig {
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

/** Response from POST /admin/stack/:project/restart — build has been launched, not finished. */
interface StackBuildStartResult {
  projectName: string;
  buildId: string;
  pid: number;
  logPath: string;
  startedAt: string;
  commitHash: string;
}

type BuildState = "running" | "success" | "failed" | "stalled" | "unknown";

interface StackBuildStatusResult {
  buildId: string;
  state: BuildState;
  exitCode: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  commitHash: string | null;
  tail: string[];
}

interface SshExecResult {
  stdout: string;
  stderr: string;
  code: number | null;
}

// ─── Git helpers (read-only, run in the api container against /host-repo) ──

async function runGit(...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(GIT_COMMAND, ["-C", HOST_REPO_PATH, ...args], {
    timeout: 30_000,
    env: { ...process.env, LC_ALL: DEFAULT_LOCALE },
  });
  return stdout.trim();
}

// ─── SSH config loaders ────────────────────────────────────────────────────

function parseSshPort(rawPort: string | undefined): number {
  if (!rawPort) return DEFAULT_SSH_PORT;
  const parsed = Number(rawPort);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(
      `${ENV_SSH_PORT} must be a positive integer`,
      500,
      "HOST_SSH_CONFIG_INVALID",
    );
  }
  return parsed;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new AppError(
      `Host SSH is not configured: missing ${name}`,
      500,
      "HOST_SSH_CONFIG_MISSING",
    );
  }
  return value;
}

function shellEscapeSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function loadHostSshConfig(): HostSshConfig {
  const passphrase = process.env[ENV_SSH_PRIVATE_KEY_PASSPHRASE]?.trim();
  return {
    host: getRequiredEnv(ENV_SSH_HOST),
    port: parseSshPort(process.env[ENV_SSH_PORT]),
    username: getRequiredEnv(ENV_SSH_USER),
    privateKeyPath: getRequiredEnv(ENV_SSH_PRIVATE_KEY_PATH),
    remoteRepoPath:
      process.env[ENV_REMOTE_REPO_PATH]?.trim() || DEFAULT_REMOTE_REPO_PATH,
    ...(passphrase ? { passphrase } : {}),
  };
}

// ─── Generic SSH command runner ────────────────────────────────────────────

interface RunSshOptions {
  /** Total timeout for the exec phase (after connect). */
  execTimeoutMs?: number;
  /** If true, do NOT reject on non-zero exit — resolve with result.code instead. */
  allowNonZeroExit?: boolean;
}

async function runSshCommand(
  config: HostSshConfig,
  command: string,
  opts: RunSshOptions = {},
): Promise<SshExecResult> {
  const privateKey = await readFile(config.privateKeyPath, "utf-8");
  const execTimeoutMs = opts.execTimeoutMs ?? SSH_EXEC_TIMEOUT_MS;

  return await new Promise<SshExecResult>((resolve, reject) => {
    const conn = new Client();
    let finished = false;
    let timeoutHandle: NodeJS.Timeout | undefined;

    const finish = (result?: SshExecResult, err?: Error): void => {
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
      readyTimeout: SSH_READY_TIMEOUT_MS,
      ...(config.passphrase ? { passphrase: config.passphrase } : {}),
    };

    conn.on("ready", () => {
      timeoutHandle = setTimeout(() => {
        finish(undefined, new Error("SSH command timed out"));
      }, execTimeoutMs);

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
          const result: SshExecResult = {
            stdout: stdout.trim(),
            stderr: stderr.trim(),
            code,
          };
          if (!opts.allowNonZeroExit && code !== 0) {
            finish(
              undefined,
              new Error(`Remote command exited with code ${code ?? -1}: ${stderr.trim()}`),
            );
            return;
          }
          finish(result);
        });
      });
    });

    conn.on("error", (err: Error) => {
      finish(undefined, err);
    });

    conn.connect(connectConfig);
  });
}

async function runGitPullViaSsh(config: HostSshConfig): Promise<GitPullResult> {
  const command = `${GIT_COMMAND} -C ${shellEscapeSingleQuoted(config.remoteRepoPath)} pull`;
  const { stdout, stderr } = await runSshCommand(config, command);
  return { stdout, stderr };
}

// ─── Stack build via SSH ───────────────────────────────────────────────────

/**
 * Build the shell script that kicks off a detached `docker compose up --build -d`
 * on the host.  Key properties:
 *
 * - Runs on the host (not in the api container), so the api rebuilding its own
 *   stack cannot kill the in-flight build.
 * - Uses `flock -n` per-stack so double-clicks / overlapping requests fail
 *   fast with exit code 75 instead of racing two concurrent builds.
 * - Writes all output to /host-repo/logs/build-<ts>-<project>.log so status
 *   polling and (Phase 2) streaming can tail it without any in-memory state.
 * - Emits __BUILD_START__ header + __BUILD_OK__ / __BUILD_FAIL__:<rc> sentinels
 *   that the status endpoint parses.
 *
 * Injection safety: the three stack-derived values (project, compose file,
 * repo root) are each wrapped in shell single-quotes at template-substitution
 * time.  The inner worker receives every outer value as a POSITIONAL ARG via
 * `sh -c 'body' _ "$OUTER_VAR" ...` — no `$foo` is ever re-expanded inside the
 * single-quoted worker body.
 */
function buildStackScript(params: {
  projectName: string;
  composeFilePath: string;
  remoteRepoPath: string;
}): string {
  const projectArg = shellEscapeSingleQuoted(params.projectName);
  const composeArg = shellEscapeSingleQuoted(params.composeFilePath);
  const repoArg = shellEscapeSingleQuoted(params.remoteRepoPath);

  // Worker body — runs detached in the background child.  Context arrives
  // as positional args ($1..$6).  Fd 9 is INHERITED from the outer shell
  // which already holds the per-stack flock — the worker does not need to
  // re-acquire it, and the lock is released only when the worker exits
  // (because its fd 9 is the last reference to the open file description).
  const worker = [
    `set -u`,
    `LOG="$1"; COMPOSE_FILE="$2"; BUILD_ID="$3"; STARTED_AT="$4"; COMMIT="$5"; PROJECT="$6"`,
    `printf "%s %s\\n" "${BUILD_START_MARKER}" "{\\"buildId\\":\\"$BUILD_ID\\",\\"pid\\":$$,\\"startedAt\\":\\"$STARTED_AT\\",\\"commitHash\\":\\"$COMMIT\\",\\"project\\":\\"$PROJECT\\"}" > "$LOG"`,
    `docker compose -f "$COMPOSE_FILE" up --build -d >> "$LOG" 2>&1`,
    `RC=$?`,
    `FINISHED_AT=$(date -Iseconds)`,
    `if [ "$RC" -eq 0 ]; then`,
    `  printf "%s {\\"finishedAt\\":\\"%s\\"}\\n" "${BUILD_OK_MARKER}" "$FINISHED_AT" >> "$LOG"`,
    `else`,
    `  printf "%s:%s {\\"finishedAt\\":\\"%s\\"}\\n" "${BUILD_FAIL_MARKER}" "$RC" "$FINISHED_AT" >> "$LOG"`,
    `fi`,
  ].join("\n");

  return [
    `set -u`,
    `PROJECT=${projectArg}`,
    `COMPOSE_FILE=${composeArg}`,
    `REPO_ROOT=${repoArg}`,
    ``,
    `LOGS_DIR="$REPO_ROOT/logs"`,
    `mkdir -p "$LOGS_DIR"`,
    ``,
    `TS=$(date +%s)`,
    `BUILD_ID="\${TS}-\${PROJECT}"`,
    `LOG="$LOGS_DIR/build-$BUILD_ID.log"`,
    `LOCK="$LOGS_DIR/.build-\${PROJECT}.lock"`,
    `COMMIT=$(git -C "$REPO_ROOT" rev-parse HEAD 2>/dev/null || echo unknown)`,
    `STARTED_AT=$(date -Iseconds)`,
    ``,
    `# Acquire the per-stack lock in THIS shell.  The backgrounded worker`,
    `# below inherits fd 9 via fork, so the open file description (and the`,
    `# flock on it) persists for the entire build — even though this outer`,
    `# shell exits immediately after spawning the worker.`,
    `exec 9<>"$LOCK"`,
    `if ! flock -n 9; then`,
    `  echo "BUILD_ALREADY_RUNNING" >&2`,
    `  exit ${BUILD_LOCK_EXIT_CODE}`,
    `fi`,
    ``,
    `# Launch detached worker.  nohup + </dev/null + &>/dev/null detach it`,
    `# from the SSH channel so this outer shell returning cannot SIGHUP it.`,
    `nohup sh -c ${shellEscapeSingleQuoted(worker)} _ \\`,
    `  "$LOG" "$COMPOSE_FILE" "$BUILD_ID" "$STARTED_AT" "$COMMIT" "$PROJECT" \\`,
    `  </dev/null >/dev/null 2>&1 &`,
    ``,
    `PID=$!`,
    `disown $PID 2>/dev/null || true`,
    ``,
    `printf '{"buildId":"%s","pid":%s,"logPath":"%s","commitHash":"%s","startedAt":"%s"}\\n' "$BUILD_ID" "$PID" "$LOG" "$COMMIT" "$STARTED_AT"`,
  ].join("\n");
}

interface BuildLaunchInfo {
  buildId: string;
  pid: number;
  logPath: string;
  commitHash: string;
  startedAt: string;
}

async function launchStackBuildViaSsh(params: {
  config: HostSshConfig;
  projectName: string;
  composeFilePath: string;
}): Promise<BuildLaunchInfo> {
  const script = buildStackScript({
    projectName: params.projectName,
    composeFilePath: params.composeFilePath,
    remoteRepoPath: params.config.remoteRepoPath,
  });
  const result = await runSshCommand(params.config, script, {
    allowNonZeroExit: true,
  });

  if (result.code === BUILD_LOCK_EXIT_CODE) {
    throw new AppError(
      `A build for "${params.projectName}" is already running`,
      409,
      "BUILD_ALREADY_RUNNING",
    );
  }
  if (result.code !== 0) {
    throw new AppError(
      `Failed to launch build: ${result.stderr || `exit ${result.code ?? -1}`}`,
      500,
      "STACK_BUILD_START_FAILED",
    );
  }

  // The script's final line is a single JSON object.
  const lastLine = result.stdout.split("\n").filter((l) => l.trim()).pop() ?? "";
  try {
    const parsed = JSON.parse(lastLine) as BuildLaunchInfo;
    return parsed;
  } catch {
    throw new AppError(
      `Build launched but response was unparseable: ${lastLine}`,
      500,
      "STACK_BUILD_START_FAILED",
    );
  }
}

// ─── Build status (reads the log file directly from /host-repo) ────────────

interface ParsedHeader {
  buildId: string;
  pid: number;
  startedAt: string;
  commitHash: string;
  project: string;
}

interface ParsedFooter {
  ok: boolean;
  exitCode: number | null;
  finishedAt: string | null;
}

function parseBuildHeader(line: string): ParsedHeader | null {
  if (!line.startsWith(`${BUILD_START_MARKER} `)) return null;
  const jsonPart = line.slice(BUILD_START_MARKER.length + 1);
  try {
    return JSON.parse(jsonPart) as ParsedHeader;
  } catch {
    return null;
  }
}

function parseBuildFooter(line: string, logger?: pino.Logger): ParsedFooter | null {
  if (line.startsWith(`${BUILD_OK_MARKER} `)) {
    const payload = line.slice(BUILD_OK_MARKER.length + 1);
    try {
      const data = JSON.parse(payload) as { finishedAt: string };
      return { ok: true, exitCode: 0, finishedAt: data.finishedAt };
    } catch (err) {
      logger?.warn(
        { marker: BUILD_OK_MARKER, payload, err },
        "Build footer JSON parse failed — finishedAt will be null",
      );
      return { ok: true, exitCode: 0, finishedAt: null };
    }
  }
  if (line.startsWith(`${BUILD_FAIL_MARKER}:`)) {
    const rest = line.slice(BUILD_FAIL_MARKER.length + 1);
    const spaceIdx = rest.indexOf(" ");
    const codeStr = spaceIdx === -1 ? rest : rest.slice(0, spaceIdx);
    const code = Number.parseInt(codeStr, 10);
    let finishedAt: string | null = null;
    if (spaceIdx !== -1) {
      const payload = rest.slice(spaceIdx + 1);
      try {
        const data = JSON.parse(payload) as { finishedAt: string };
        finishedAt = data.finishedAt;
      } catch (err) {
        logger?.warn(
          { marker: BUILD_FAIL_MARKER, payload, err },
          "Build footer JSON parse failed — finishedAt will be null",
        );
      }
    }
    return { ok: false, exitCode: Number.isFinite(code) ? code : null, finishedAt };
  }
  return null;
}

function buildLogPathFor(buildId: string): string {
  // buildId format: "<unix-ts>-<project>"
  return path.join(HOST_REPO_PATH, "logs", `build-${buildId}.log`);
}

function isSafeBuildId(buildId: string): boolean {
  // Guard against path traversal before resolving the log file.
  return /^[0-9]+-[a-zA-Z0-9_-]+$/.test(buildId);
}

async function readBuildStatus(buildId: string, logger?: pino.Logger): Promise<StackBuildStatusResult> {
  const logPath = buildLogPathFor(buildId);
  let content: string;
  let lastModifiedMs: number;
  try {
    const [raw, st] = await Promise.all([readFile(logPath, "utf-8"), stat(logPath)]);
    content = raw;
    lastModifiedMs = st.mtimeMs;
  } catch {
    throw new AppError(`Unknown build: ${buildId}`, 404, "BUILD_NOT_FOUND");
  }

  const lines = content.split("\n");
  // Header is always the first non-empty line.
  const headerLine = lines.find((l) => l.startsWith(BUILD_START_MARKER)) ?? "";
  const header = parseBuildHeader(headerLine);

  // Footer is always the last non-empty line that matches a sentinel.
  let footer: ParsedFooter | null = null;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const f = parseBuildFooter(lines[i] ?? "", logger);
    if (f) {
      footer = f;
      break;
    }
  }

  const nonEmpty = lines.filter((l) => l.length > 0);
  const tail = nonEmpty.slice(-BUILD_STATUS_TAIL_LINES);

  let state: BuildState;
  if (footer) {
    state = footer.ok ? "success" : "failed";
  } else if (Date.now() - lastModifiedMs > BUILD_STALL_MS) {
    state = "stalled";
  } else {
    state = "running";
  }

  const startedAt = header?.startedAt ?? null;
  const finishedAt = footer?.finishedAt ?? null;
  let durationMs: number | null = null;
  if (startedAt && finishedAt) {
    const s = Date.parse(startedAt);
    const f = Date.parse(finishedAt);
    if (Number.isFinite(s) && Number.isFinite(f)) durationMs = f - s;
  }

  return {
    buildId,
    state,
    exitCode: footer?.exitCode ?? null,
    startedAt,
    finishedAt,
    durationMs,
    commitHash: header?.commitHash ?? null,
    tail,
  };
}

// ─── Router ───────────────────────────────────────────────────────────────

export function adminRouter(dashboardConfig: DashboardConfig, logger?: pino.Logger): Router {
  const router = Router();

  const allowedProjects = new Set(
    (dashboardConfig.adminStacks ?? []).map((s) => s.projectName),
  );

  /**
   * Resolves a project name to the absolute path of its docker-compose.yml
   * on the HOST (via LINOS_GIT_PULL_REMOTE_REPO_PATH).  Falls back to
   * HOST_REPO_PATH when the env var is unset — which matches the git-pull
   * helper's default.  The api container's own `/host-repo` mount is only
   * used for local reads (git status, build log tailing).
   */
  const hostComposePath = (projectName: string, remoteRepoPath: string): string | null => {
    const stack = (dashboardConfig.adminStacks ?? []).find(
      (s) => s.projectName === projectName,
    );
    if (!stack?.composePath) return null;
    // Use posix join because the host is Linux; path.posix keeps forward slashes
    // even if this ever runs on Windows (it won't, but it's cheap).
    return path.posix.join(remoteRepoPath, stack.composePath, "docker-compose.yml");
  };

  // POST /admin/stack/:projectName/restart — launch detached build over SSH
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

      const config = loadHostSshConfig();
      const composeFilePath = hostComposePath(projectName, config.remoteRepoPath);
      if (!composeFilePath) {
        throw new AppError(
          `No composePath configured for stack: ${projectName}`,
          400,
          "MISSING_COMPOSE_PATH",
        );
      }

      const launch = await launchStackBuildViaSsh({
        config,
        projectName,
        composeFilePath,
      });

      const data: StackBuildStartResult = {
        projectName,
        buildId: launch.buildId,
        pid: launch.pid,
        logPath: launch.logPath,
        startedAt: launch.startedAt,
        commitHash: launch.commitHash,
      };
      res.json({ ok: true, data } satisfies ApiResponse<StackBuildStartResult>);
    },
  );

  // GET /admin/stack/:projectName/build-status?buildId=...
  router.get(
    "/admin/stack/:projectName/build-status",
    async (req: Request, res: Response): Promise<void> => {
      const rawParam = req.params.projectName;
      const projectName = Array.isArray(rawParam) ? rawParam[0] : rawParam;
      if (!projectName || !allowedProjects.has(projectName)) {
        throw new AppError(`Unknown stack: ${projectName ?? "undefined"}`, 400, "INVALID_STACK");
      }

      const rawBuildId = req.query.buildId;
      const buildId =
        typeof rawBuildId === "string" ? rawBuildId : Array.isArray(rawBuildId) ? String(rawBuildId[0]) : "";
      if (!buildId || !isSafeBuildId(buildId)) {
        throw new AppError("Missing or invalid buildId", 400, "INVALID_BUILD_ID");
      }

      // Reject mismatched project/buildId pairs up-front (buildId ends with `-<project>`).
      if (!buildId.endsWith(`-${projectName}`)) {
        throw new AppError(
          `buildId does not belong to stack ${projectName}`,
          400,
          "INVALID_BUILD_ID",
        );
      }

      const data = await readBuildStatus(buildId, logger);
      res.json({ ok: true, data } satisfies ApiResponse<StackBuildStatusResult>);
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
        const config = loadHostSshConfig();
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
