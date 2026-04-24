import { readFile, stat } from "fs/promises";
import path from "path";
import type pino from "pino";
import { AppError } from "../middleware/errors.js";
import {
  BUILD_START_MARKER,
  BUILD_OK_MARKER,
  BUILD_FAIL_MARKER,
  type BuildState,
} from "./admin.build.js";
import { HOST_REPO_PATH } from "./admin.helpers.js";

const BUILD_STATUS_TAIL_LINES = 40;
const BUILD_STALL_MS = 15 * 60_000;

export interface StackBuildStatusResult {
  buildId: string;
  state: BuildState;
  exitCode: number | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number | null;
  commitHash: string | null;
  tail: string[];
}

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
      logger?.warn({ marker: BUILD_OK_MARKER, payload, err }, "Build footer JSON parse failed — finishedAt will be null");
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
        logger?.warn({ marker: BUILD_FAIL_MARKER, payload, err }, "Build footer JSON parse failed — finishedAt will be null");
      }
    }
    return { ok: false, exitCode: Number.isFinite(code) ? code : null, finishedAt };
  }
  return null;
}

export function isSafeBuildId(buildId: string): boolean {
  return /^[0-9]+-[a-zA-Z0-9_-]+$/.test(buildId);
}

export async function readBuildStatus(buildId: string, logger?: pino.Logger): Promise<StackBuildStatusResult> {
  const logPath = path.join(HOST_REPO_PATH, "logs", `build-${buildId}.log`);
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
  const headerLine = lines.find((l) => l.startsWith(BUILD_START_MARKER)) ?? "";
  const header = parseBuildHeader(headerLine);

  let footer: ParsedFooter | null = null;
  for (let i = lines.length - 1; i >= 0; i -= 1) {
    const f = parseBuildFooter(lines[i] ?? "", logger);
    if (f) { footer = f; break; }
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
