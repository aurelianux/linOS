import { AppError } from "../middleware/errors.js";
import { type HostSshConfig, runSshCommand } from "./admin.ssh.js";
import { shellEscapeSingleQuoted } from "./admin.helpers.js";

export const BUILD_LOCK_EXIT_CODE = 75;
export const BUILD_START_MARKER = "__BUILD_START__";
export const BUILD_OK_MARKER = "__BUILD_OK__";
export const BUILD_FAIL_MARKER = "__BUILD_FAIL__";

interface BuildLaunchInfo {
  buildId: string;
  pid: number;
  logPath: string;
  commitHash: string;
  startedAt: string;
}

export interface StackBuildStartResult {
  projectName: string;
  buildId: string;
  pid: number;
  logPath: string;
  startedAt: string;
  commitHash: string;
}

export type BuildState = "running" | "success" | "failed" | "stalled" | "unknown";

function buildStackScript(params: {
  projectName: string;
  composeFilePath: string;
  remoteRepoPath: string;
}): string {
  const projectArg = shellEscapeSingleQuoted(params.projectName);
  const composeArg = shellEscapeSingleQuoted(params.composeFilePath);
  const repoArg = shellEscapeSingleQuoted(params.remoteRepoPath);

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
    `exec 9<>"$LOCK"`,
    `if ! flock -n 9; then`,
    `  echo "BUILD_ALREADY_RUNNING" >&2`,
    `  exit ${BUILD_LOCK_EXIT_CODE}`,
    `fi`,
    ``,
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

export async function launchStackBuildViaSsh(params: {
  config: HostSshConfig;
  projectName: string;
  composeFilePath: string;
}): Promise<BuildLaunchInfo> {
  const script = buildStackScript({
    projectName: params.projectName,
    composeFilePath: params.composeFilePath,
    remoteRepoPath: params.config.remoteRepoPath,
  });
  const result = await runSshCommand(params.config, script, { allowNonZeroExit: true });

  if (result.code === BUILD_LOCK_EXIT_CODE) {
    throw new AppError(`A build for "${params.projectName}" is already running`, 409, "BUILD_ALREADY_RUNNING");
  }
  if (result.code !== 0) {
    throw new AppError(
      `Failed to launch build: ${result.stderr || `exit ${result.code ?? -1}`}`,
      500,
      "STACK_BUILD_START_FAILED",
    );
  }

  const lastLine = result.stdout.split("\n").filter((l) => l.trim()).pop() ?? "";
  try {
    return JSON.parse(lastLine) as BuildLaunchInfo;
  } catch {
    throw new AppError(`Build launched but response was unparseable: ${lastLine}`, 500, "STACK_BUILD_START_FAILED");
  }
}
