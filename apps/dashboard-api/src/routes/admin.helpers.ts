import { execFile } from "child_process";
import { promisify } from "util";
import { AppError } from "../middleware/errors.js";
import { type HostSshConfig, runSshCommand } from "./admin.ssh.js";

const execFileAsync = promisify(execFile);

export const HOST_REPO_PATH = "/host-repo";
const DEFAULT_LOCALE = "C";
const GIT_COMMAND = "git";
export const DEFAULT_SSH_PORT = 22;
const DEFAULT_REMOTE_REPO_PATH = "/host-repo";

const ENV_SSH_HOST = "LINOS_GIT_PULL_SSH_HOST";
const ENV_SSH_PORT = "LINOS_GIT_PULL_SSH_PORT";
const ENV_SSH_USER = "LINOS_GIT_PULL_SSH_USER";
const ENV_SSH_PRIVATE_KEY_PATH = "LINOS_GIT_PULL_SSH_PRIVATE_KEY_PATH";
const ENV_SSH_PRIVATE_KEY_PASSPHRASE = "LINOS_GIT_PULL_SSH_PRIVATE_KEY_PASSPHRASE";
const ENV_REMOTE_REPO_PATH = "LINOS_GIT_PULL_REMOTE_REPO_PATH";

export function shellEscapeSingleQuoted(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function parseSshPort(rawPort: string | undefined): number {
  if (!rawPort) return DEFAULT_SSH_PORT;
  const parsed = Number(rawPort);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new AppError(`${ENV_SSH_PORT} must be a positive integer`, 500, "HOST_SSH_CONFIG_INVALID");
  }
  return parsed;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new AppError(`Host SSH is not configured: missing ${name}`, 500, "HOST_SSH_CONFIG_MISSING");
  }
  return value;
}

export function loadHostSshConfig(): HostSshConfig {
  const passphrase = process.env[ENV_SSH_PRIVATE_KEY_PASSPHRASE]?.trim();
  return {
    host: getRequiredEnv(ENV_SSH_HOST),
    port: parseSshPort(process.env[ENV_SSH_PORT]),
    username: getRequiredEnv(ENV_SSH_USER),
    privateKeyPath: getRequiredEnv(ENV_SSH_PRIVATE_KEY_PATH),
    remoteRepoPath: process.env[ENV_REMOTE_REPO_PATH]?.trim() || DEFAULT_REMOTE_REPO_PATH,
    ...(passphrase ? { passphrase } : {}),
  };
}

export async function runGit(...args: string[]): Promise<string> {
  const { stdout } = await execFileAsync(GIT_COMMAND, ["-C", HOST_REPO_PATH, ...args], {
    timeout: 30_000,
    env: { ...process.env, LC_ALL: DEFAULT_LOCALE },
  });
  return stdout.trim();
}

export interface GitPullResult {
  stdout: string;
  stderr: string;
}

export async function runGitPullViaSsh(config: HostSshConfig): Promise<GitPullResult> {
  const command = `${GIT_COMMAND} -C ${shellEscapeSingleQuoted(config.remoteRepoPath)} pull`;
  const { stdout, stderr } = await runSshCommand(config, command);
  return { stdout, stderr };
}

export interface GitStatusResult {
  branch: string;
  lastCommit: { hash: string; message: string; relativeTime: string };
  ahead: number;
  behind: number;
  dirty: number;
  untracked: number;
}

export async function fetchGitStatus(): Promise<GitStatusResult> {
  const [branch, commitLine, porcelain, revList] = await Promise.all([
    runGit("rev-parse", "--abbrev-ref", "HEAD"),
    runGit("log", "-1", "--format=%h\t%s\t%ar"),
    runGit("status", "--porcelain").catch(() => ""),
    runGit("rev-list", "--count", "--left-right", "HEAD...@{upstream}").catch(() => "0\t0"),
  ]);
  const [hash = "", message = "", relativeTime = ""] = commitLine.split("\t");
  const lines = porcelain ? porcelain.split("\n") : [];
  const dirty = lines.filter((l) => !l.startsWith("??")).length;
  const untracked = lines.filter((l) => l.startsWith("??")).length;
  const [aheadStr = "0", behindStr = "0"] = revList.split("\t");
  return {
    branch,
    lastCommit: { hash, message, relativeTime },
    ahead: Number(aheadStr),
    behind: Number(behindStr),
    dirty,
    untracked,
  };
}
