import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import {
  mdiServerNetwork,
  mdiRestart,
  mdiSourceBranch,
  mdiCheck,
  mdiLoading,
  mdiArrowUp,
  mdiArrowDown,
  mdiFileEditOutline,
  mdiFileQuestionOutline,
  mdiChevronDown,
  mdiTextBoxOutline,
  mdiAlertCircleOutline,
  mdiContentCopy,
} from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsiblePanel } from "@/components/common/CollapsiblePanel";
import { LoadingState } from "@/components/common/LoadingState";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useDockerContainers } from "@/hooks/useDockerContainers";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { fetchJson } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import type {
  ContainerInfo,
  AdminStack,
  ContainerRestartResult,
  ContainerLogsResult,
  StackRestartResult,
  GitPullResult,
  GitStatus,
} from "@/lib/api/types";

// ─── Types ────────────────────────────────────────────────────────────────

type ActionState = "idle" | "loading" | "success" | "error";

// ─── State dot ────────────────────────────────────────────────────────────

const STATE_COLOR: Record<string, string> = {
  running: "bg-emerald-400",
  paused: "bg-amber-400",
  restarting: "bg-amber-400",
  exited: "bg-red-400",
  dead: "bg-red-400",
  created: "bg-slate-500",
};

function StateDot({ state }: { state: string }) {
  const color = STATE_COLOR[state] ?? "bg-slate-500";
  return (
    <span
      className={cn("h-2 w-2 rounded-full shrink-0", color)}
      aria-hidden="true"
    />
  );
}

// ─── Git Status Section ───────────────────────────────────────────────────

function GitStatusSection({
  gitStatus,
  gitStatusLoading,
}: {
  gitStatus: GitStatus | null;
  gitStatusLoading: boolean;
}) {
  const { t } = useTranslation();

  if (gitStatusLoading && !gitStatus) {
    return (
      <div className="flex items-center gap-2 py-2">
        <Icon path={mdiLoading} size={0.7} className="text-slate-500 animate-spin" />
        <span className="text-xs text-slate-500">{t("admin.actions.gitStatus")}…</span>
      </div>
    );
  }

  if (!gitStatus) return null;

  const hasDirty = gitStatus.dirty > 0 || gitStatus.untracked > 0;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2 flex-wrap">
        <Icon path={mdiSourceBranch} size={0.7} className="text-slate-400" />
        <Badge variant="secondary">{gitStatus.branch}</Badge>
        {gitStatus.ahead > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-sky-400">
            <Icon path={mdiArrowUp} size={0.5} />
            {gitStatus.ahead} {t("admin.actions.gitAhead")}
          </span>
        )}
        {gitStatus.behind > 0 && (
          <span className="flex items-center gap-0.5 text-xs text-amber-400">
            <Icon path={mdiArrowDown} size={0.5} />
            {gitStatus.behind} {t("admin.actions.gitBehind")}
          </span>
        )}
      </div>

      <div className="text-xs text-slate-400 truncate" title={gitStatus.lastCommit.message}>
        <span className="font-mono text-slate-300">{gitStatus.lastCommit.hash}</span>
        {" "}
        {gitStatus.lastCommit.message}
        {" — "}
        <span className="text-slate-500">{gitStatus.lastCommit.relativeTime}</span>
      </div>

      {hasDirty ? (
        <div className="flex items-center gap-3 text-xs">
          {gitStatus.dirty > 0 && (
            <span className="flex items-center gap-1 text-amber-400">
              <Icon path={mdiFileEditOutline} size={0.5} />
              {gitStatus.dirty} {t("admin.actions.gitDirty")}
            </span>
          )}
          {gitStatus.untracked > 0 && (
            <span className="flex items-center gap-1 text-slate-500">
              <Icon path={mdiFileQuestionOutline} size={0.5} />
              {gitStatus.untracked} {t("admin.actions.gitUntracked")}
            </span>
          )}
        </div>
      ) : (
        <span className="text-xs text-emerald-400">{t("admin.actions.gitClean")}</span>
      )}
    </div>
  );
}

// ─── Container Row ────────────────────────────────────────────────────────

function ContainerRow({
  container,
  restartState,
  logsState,
  onRestart,
  onCopyLogs,
}: {
  container: ContainerInfo;
  restartState: ActionState;
  logsState: ActionState;
  onRestart: () => void;
  onCopyLogs: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 py-1.5 pl-4">
      <StateDot state={container.state} />
      <span
        className="text-sm text-slate-200 truncate min-w-0 flex-1"
        title={container.name}
      >
        {container.name}
      </span>
      <span className="text-xs text-slate-500 shrink-0 hidden sm:inline">
        {container.status}
      </span>

      {/* Logs copy feedback */}
      {logsState === "success" && (
        <span className="text-xs text-emerald-400 shrink-0">{t("infra.logsCopied")}</span>
      )}
      {logsState === "error" && (
        <span className="text-xs text-red-400 shrink-0">{t("infra.logsError")}</span>
      )}

      {/* Logs button */}
      <button
        type="button"
        onClick={onCopyLogs}
        disabled={logsState === "loading"}
        className="shrink-0 h-6 w-6 flex items-center justify-center rounded hover:bg-slate-800 transition-colors disabled:opacity-50"
        aria-label={`${t("infra.logs")} ${container.name}`}
        title={t("infra.logs")}
      >
        <Icon
          path={logsState === "loading" ? mdiLoading : logsState === "success" ? mdiContentCopy : mdiTextBoxOutline}
          size={0.6}
          className={cn(
            logsState === "loading" && "animate-spin text-slate-400",
            logsState === "success" && "text-emerald-400",
            logsState === "error" && "text-red-400",
            logsState === "idle" && "text-slate-500 hover:text-slate-300",
          )}
        />
      </button>

      {/* Restart feedback */}
      {restartState === "success" && (
        <span className="text-xs text-emerald-400 shrink-0">{t("infra.restartSuccess")}</span>
      )}
      {restartState === "error" && (
        <span className="text-xs text-red-400 shrink-0">{t("infra.restartError")}</span>
      )}

      {/* Restart button */}
      <button
        type="button"
        onClick={onRestart}
        disabled={restartState === "loading"}
        className="shrink-0 h-6 w-6 flex items-center justify-center rounded hover:bg-slate-800 transition-colors disabled:opacity-50"
        aria-label={`${t("infra.restart")} ${container.name}`}
        title={t("infra.restart")}
      >
        <Icon
          path={restartState === "loading" ? mdiLoading : restartState === "success" ? mdiCheck : mdiRestart}
          size={0.6}
          className={cn(
            restartState === "loading" && "animate-spin text-slate-400",
            restartState === "success" && "text-emerald-400",
            restartState === "error" && "text-red-400",
            restartState === "idle" && "text-slate-500 hover:text-slate-300",
          )}
        />
      </button>
    </div>
  );
}

// ─── Stack Group ──────────────────────────────────────────────────────────

function StackGroup({
  stack,
  containers,
  expanded,
  onToggle,
  stackRestartState,
  containerStates,
  logsStates,
  onStackRestart,
  onContainerRestart,
  onCopyLogs,
}: {
  stack: AdminStack;
  containers: ContainerInfo[];
  expanded: boolean;
  onToggle: () => void;
  stackRestartState: ActionState;
  containerStates: Record<string, ActionState>;
  logsStates: Record<string, ActionState>;
  onStackRestart: () => void;
  onContainerRestart: (id: string) => void;
  onCopyLogs: (id: string) => void;
}) {
  const { t } = useTranslation();
  const allRunning = containers.length > 0 && containers.every((c) => c.state === "running");
  const someDown = containers.some((c) => c.state !== "running");

  return (
    <div className="border-b border-slate-800 last:border-0">
      {/* Stack header */}
      <div className="flex items-center gap-2 py-2">
        <button
          type="button"
          onClick={onToggle}
          className="flex items-center gap-2 flex-1 min-w-0 hover:bg-slate-800/50 rounded px-1 py-0.5 transition-colors"
        >
          <Icon
            path={mdiChevronDown}
            size={0.65}
            className={cn(
              "text-slate-500 shrink-0 transition-transform duration-200",
              !expanded && "-rotate-90",
            )}
          />
          <span className="text-sm font-medium text-slate-100 truncate">
            {stack.label}
          </span>
          <Badge
            variant={containers.length === 0 ? "secondary" : allRunning ? "success" : someDown ? "warning" : "secondary"}
            className="text-[10px] px-1.5 py-0"
          >
            {containers.length}
          </Badge>
        </button>

        {/* Stack-level restart */}
        <div className="flex items-center gap-1 shrink-0">
          {stackRestartState === "success" && (
            <span className="text-xs text-emerald-400">{t("infra.restartSuccess")}</span>
          )}
          {stackRestartState === "error" && (
            <span className="text-xs text-red-400">{t("infra.restartError")}</span>
          )}
          <button
            type="button"
            onClick={onStackRestart}
            disabled={stackRestartState === "loading" || containers.length === 0}
            className="h-7 w-7 flex items-center justify-center rounded hover:bg-slate-800 transition-colors disabled:opacity-50"
            aria-label={`${t("infra.restart")} ${stack.label}`}
            title={`${t("infra.restart")} ${stack.label}`}
          >
            <Icon
              path={stackRestartState === "loading" ? mdiLoading : stackRestartState === "success" ? mdiCheck : mdiRestart}
              size={0.7}
              className={cn(
                stackRestartState === "loading" && "animate-spin text-slate-400",
                stackRestartState === "success" && "text-emerald-400",
                stackRestartState === "error" && "text-red-400",
                stackRestartState === "idle" && "text-slate-400",
              )}
            />
          </button>
        </div>
      </div>

      {/* Container rows */}
      {expanded && containers.length > 0 && (
        <div className="pb-2">
          {containers.map((c) => (
            <ContainerRow
              key={c.id}
              container={c}
              restartState={containerStates[c.id] ?? "idle"}
              logsState={logsStates[c.id] ?? "idle"}
              onRestart={() => onContainerRestart(c.id)}
              onCopyLogs={() => onCopyLogs(c.id)}
            />
          ))}
        </div>
      )}

      {expanded && containers.length === 0 && (
        <p className="text-xs text-slate-500 pl-4 pb-2">{t("infra.noContainers")}</p>
      )}
    </div>
  );
}

// ─── Docker Unavailable Notice ────────────────────────────────────────────

function DockerUnavailableNotice({
  reason,
  code,
}: {
  reason: string;
  code: string | null;
}) {
  const { t } = useTranslation();
  const showSocketHint = code === "SOCKET_NOT_FOUND";

  return (
    <div className="space-y-3 py-2">
      <div className="flex items-start gap-2">
        <Icon
          path={mdiAlertCircleOutline}
          size={1}
          className="text-amber-400 shrink-0 mt-0.5"
        />
        <p className="text-sm text-amber-400">{reason}</p>
      </div>
      {showSocketHint && (
        <>
          <p className="text-xs text-slate-500">
            {t("docker.socketHint")}{" "}
            <code className="bg-slate-800 px-1 rounded text-slate-300">
              docker-compose.yml
            </code>
            :
          </p>
          <pre className="text-xs bg-slate-800 text-slate-300 rounded px-3 py-2 overflow-x-auto">
            {"<HOST_DOCKER_SOCKET>:/var/run/docker.sock:ro"}
          </pre>
        </>
      )}
    </div>
  );
}

// ─── Health Poller ────────────────────────────────────────────────────────

function useHealthPoller(active: boolean, onReconnect: () => void) {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!active) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }
    intervalRef.current = setInterval(async () => {
      try {
        await fetchJson<unknown>("/health");
        onReconnect();
      } catch {
        // Still waiting
      }
    }, 2000);
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [active, onReconnect]);
}

// ─── Helpers ──────────────────────────────────────────────────────────────

function groupContainersByProject(
  containers: ContainerInfo[],
  stacks: AdminStack[],
): Map<string, ContainerInfo[]> {
  const grouped = new Map<string, ContainerInfo[]>();
  for (const stack of stacks) {
    grouped.set(stack.projectName, []);
  }
  for (const c of containers) {
    const project = c.project;
    if (project && grouped.has(project)) {
      grouped.get(project)!.push(c);
    }
  }
  return grouped;
}

function useAutoResetState() {
  const [states, setStates] = useState<Record<string, ActionState>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  const setState = useCallback(
    (key: string, state: ActionState) => {
      setStates((prev) => ({ ...prev, [key]: state }));
      if (timersRef.current[key]) clearTimeout(timersRef.current[key]);
      if (state === "success" || state === "error") {
        timersRef.current[key] = setTimeout(() => {
          setStates((prev) => ({ ...prev, [key]: "idle" }));
          delete timersRef.current[key];
        }, state === "success" ? 2000 : 4000);
      }
    },
    [],
  );

  return [states, setState] as const;
}

// ─── Main Component ──────────────────────────────────────────────────────

export function UnifiedInfraPanel() {
  const { t } = useTranslation();
  const { data: config } = useDashboardConfig();
  const { data: dockerData, loading: dockerLoading, lastUpdated, refresh } = useDockerContainers();
  const stacks = useMemo(() => config?.adminStacks ?? [], [config?.adminStacks]);
  const containers = dockerData?.containers ?? [];

  // Expanded stacks (default all expanded)
  const [expandedStacks, setExpandedStacks] = useState<Set<string>>(() => {
    return new Set(stacks.map((s) => s.projectName));
  });

  // Update expanded set when stacks config changes
  useEffect(() => {
    setExpandedStacks((prev) => {
      const updated = new Set(prev);
      for (const s of stacks) {
        if (!prev.has(s.projectName) && prev.size === 0) {
          updated.add(s.projectName);
        }
      }
      return updated.size !== prev.size ? updated : prev;
    });
  }, [stacks]);

  const toggleStack = useCallback((projectName: string) => {
    setExpandedStacks((prev) => {
      const next = new Set(prev);
      if (next.has(projectName)) {
        next.delete(projectName);
      } else {
        next.add(projectName);
      }
      return next;
    });
  }, []);

  // Container & stack restart states
  const [containerRestartStates, setContainerRestart] = useAutoResetState();
  const [stackRestartStates, setStackRestart] = useAutoResetState();
  const [logsStates, setLogsState] = useAutoResetState();
  const [reconnecting, setReconnecting] = useState(false);

  // Git states
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitStatusLoading, setGitStatusLoading] = useState(true);
  const [gitPullState, setGitPullState] = useState<ActionState>("idle");
  const [gitPullMessage, setGitPullMessage] = useState("");

  const fetchGitStatus = useCallback(async () => {
    try {
      const data = await fetchJson<GitStatus>(API_ENDPOINTS.ADMIN_GIT_STATUS);
      setGitStatus(data);
    } catch {
      // Informational only
    } finally {
      setGitStatusLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGitStatus();
  }, [fetchGitStatus]);

  // Health poller for dashboard self-restart
  const handleReconnect = useCallback(() => {
    setReconnecting(false);
    setStackRestart("dashboard", "success");
  }, [setStackRestart]);

  useHealthPoller(reconnecting, handleReconnect);

  // Group containers
  const grouped = groupContainersByProject(containers, stacks);

  // Container restart handler
  const handleContainerRestart = useCallback(
    async (containerId: string) => {
      setContainerRestart(containerId, "loading");
      try {
        await fetchJson<ContainerRestartResult>(
          `${API_ENDPOINTS.ADMIN_CONTAINER}/${containerId}/restart`,
          { method: "POST" },
        );
        setContainerRestart(containerId, "success");
      } catch {
        setContainerRestart(containerId, "error");
      }
    },
    [setContainerRestart],
  );

  // Stack restart handler
  const handleStackRestart = useCallback(
    async (projectName: string) => {
      setStackRestart(projectName, "loading");
      try {
        const result = await fetchJson<StackRestartResult>(
          `${API_ENDPOINTS.ADMIN_STACK_RESTART}/${projectName}/restart`,
          { method: "POST" },
        );
        if (result.failed.length > 0) {
          setStackRestart(projectName, "error");
        } else {
          setStackRestart(projectName, "success");
        }
      } catch {
        if (projectName === "dashboard") {
          setReconnecting(true);
          return;
        }
        setStackRestart(projectName, "error");
      }
    },
    [setStackRestart],
  );

  // Copy logs handler
  const handleCopyLogs = useCallback(
    async (containerId: string) => {
      setLogsState(containerId, "loading");
      try {
        const result = await fetchJson<ContainerLogsResult>(
          `${API_ENDPOINTS.ADMIN_CONTAINER}/${containerId}/logs`,
        );
        await navigator.clipboard.writeText(result.logs);
        setLogsState(containerId, "success");
      } catch {
        setLogsState(containerId, "error");
      }
    },
    [setLogsState],
  );

  // Git pull handler
  const handleGitPull = useCallback(async () => {
    setGitPullState("loading");
    setGitPullMessage("");
    try {
      const result = await fetchJson<GitPullResult>(API_ENDPOINTS.ADMIN_GIT_PULL, {
        method: "POST",
      });
      setGitPullState("success");
      setGitPullMessage(result.stdout);
      fetchGitStatus();
      setTimeout(() => {
        setGitPullState("idle");
        setGitPullMessage("");
      }, 5000);
    } catch {
      setGitPullState("error");
      setGitPullMessage(t("admin.actions.gitPullError"));
      setTimeout(() => {
        setGitPullState("idle");
        setGitPullMessage("");
      }, 5000);
    }
  }, [t, fetchGitStatus]);

  return (
    <CollapsiblePanel
      panelKey="infra"
      icon={mdiServerNetwork}
      title={t("infra.title")}
      onRefresh={refresh}
      loading={dockerLoading}
      lastUpdated={lastUpdated}
    >
      {/* Git Status */}
      <div className="pb-3 border-b border-slate-800 space-y-3">
        <GitStatusSection gitStatus={gitStatus} gitStatusLoading={gitStatusLoading} />

        <Button
          variant="secondary"
          size="sm"
          onClick={handleGitPull}
          disabled={gitPullState === "loading"}
          className="w-full gap-2"
        >
          <Icon
            path={gitPullState === "loading" ? mdiLoading : mdiSourceBranch}
            size={0.7}
            className={cn(gitPullState === "loading" && "animate-spin")}
          />
          {gitPullState === "loading"
            ? t("admin.actions.gitPulling")
            : t("admin.actions.gitPull")}
        </Button>

        {gitPullMessage && (
          <p
            className={cn(
              "text-xs truncate",
              gitPullState === "success" && "text-emerald-400",
              gitPullState === "error" && "text-red-400",
            )}
            title={gitPullMessage}
          >
            {gitPullMessage}
          </p>
        )}
      </div>

      {/* Reconnecting overlay */}
      {reconnecting && (
        <div className="flex items-center gap-2 py-2">
          <Icon path={mdiLoading} size={0.7} className="text-amber-400 animate-spin" />
          <span className="text-xs text-amber-400">{t("infra.reconnecting")}</span>
        </div>
      )}

      {/* Docker unavailable */}
      {dockerData && !dockerData.available && (
        <DockerUnavailableNotice
          reason={dockerData.unavailableReason ?? "Docker not available."}
          code={dockerData.unavailableCode ?? null}
        />
      )}

      {/* Loading */}
      {dockerLoading && !dockerData && <LoadingState />}

      {/* Stack groups */}
      {dockerData?.available && stacks.length > 0 && (
        <div className="pt-2">
          {stacks.map((stack) => (
            <StackGroup
              key={stack.projectName}
              stack={stack}
              containers={grouped.get(stack.projectName) ?? []}
              expanded={expandedStacks.has(stack.projectName)}
              onToggle={() => toggleStack(stack.projectName)}
              stackRestartState={stackRestartStates[stack.projectName] ?? "idle"}
              containerStates={containerRestartStates}
              logsStates={logsStates}
              onStackRestart={() => handleStackRestart(stack.projectName)}
              onContainerRestart={handleContainerRestart}
              onCopyLogs={handleCopyLogs}
            />
          ))}
        </div>
      )}
    </CollapsiblePanel>
  );
}
