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
  mdiRocketLaunchOutline,
} from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsiblePanel } from "@/components/common/CollapsiblePanel";
import { LoadingState } from "@/components/common/LoadingState";
import { ContainerLogViewer } from "@/components/panels/ContainerLogViewer";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useDockerContainers } from "@/hooks/useDockerContainers";
import { useGitStatus } from "@/hooks/useGitStatus";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { fetchJson } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import {
  ApiErrorException,
  type ContainerInfo,
  type AdminStack,
  type ContainerRestartResult,
  type StackBuildStartResult,
  type StackBuildStatus,
  type GitPullResult,
  type GitStatus,
} from "@/lib/api/types";

/** How often we poll /build-status while a build is running. */
const BUILD_STATUS_POLL_MS = 2_000;

// ─── Types ────────────────────────────────────────────────────────────────

type ActionState = "idle" | "loading" | "success" | "error";

/** Container for which we're viewing live logs */
interface LogTarget {
  id: string;
  name: string;
}

// ─── State badge ──────────────────────────────────────────────────────────

/** Maps container state to a visible badge variant + display label */
const STATE_BADGE_MAP: Record<string, { variant: "success" | "warning" | "destructive" | "secondary"; label: string }> = {
  running: { variant: "success", label: "Running" },
  paused: { variant: "warning", label: "Paused" },
  restarting: { variant: "warning", label: "Restarting" },
  exited: { variant: "destructive", label: "Exited" },
  dead: { variant: "destructive", label: "Dead" },
  created: { variant: "secondary", label: "Created" },
};

function StateBadge({ state }: { state: string }) {
  const info = STATE_BADGE_MAP[state] ?? { variant: "secondary" as const, label: state };
  return (
    <Badge variant={info.variant} className="text-[10px] px-1.5 py-0 capitalize">
      {info.label}
    </Badge>
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
  onRestart,
  onViewLogs,
}: {
  container: ContainerInfo;
  restartState: ActionState;
  onRestart: () => void;
  onViewLogs: () => void;
}) {
  const { t } = useTranslation();

  return (
    <div className="flex items-center gap-2 py-1.5 pl-4">
      <StateBadge state={container.state} />
      <span
        className="text-sm text-slate-200 truncate min-w-0 flex-1"
        title={container.name}
      >
        {container.name}
      </span>
      <span className="text-xs text-slate-500 shrink-0 hidden sm:inline tabular-nums">
        {container.status}
      </span>

      {/* View Logs button — text label for clarity */}
      <button
        type="button"
        onClick={onViewLogs}
        className="shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        aria-label={`${t("infra.logs")} ${container.name}`}
        title={t("infra.viewLogs")}
      >
        <Icon path={mdiTextBoxOutline} size={0.5} />
        <span className="hidden sm:inline">{t("infra.logs")}</span>
      </button>

      {/* Restart button — clearer with text + state feedback */}
      <button
        type="button"
        onClick={onRestart}
        disabled={restartState === "loading"}
        className={cn(
          "shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors",
          restartState === "idle" && "text-slate-400 hover:text-slate-200 hover:bg-slate-800",
          restartState === "loading" && "text-slate-400 bg-slate-800",
          restartState === "success" && "text-emerald-400 bg-emerald-900/30",
          restartState === "error" && "text-red-400 bg-red-900/30",
        )}
        aria-label={`${t("infra.restart")} ${container.name}`}
        title={t("infra.restart")}
      >
        <Icon
          path={restartState === "loading" ? mdiLoading : restartState === "success" ? mdiCheck : mdiRestart}
          size={0.5}
          className={cn(restartState === "loading" && "animate-spin")}
        />
        <span className="hidden sm:inline">
          {restartState === "loading"
            ? t("infra.restarting")
            : restartState === "success"
              ? t("infra.restartSuccess")
              : restartState === "error"
                ? t("infra.restartError")
                : t("infra.restart")}
        </span>
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
  onStackRestart,
  onContainerRestart,
  onViewLogs,
}: {
  stack: AdminStack;
  containers: ContainerInfo[];
  expanded: boolean;
  onToggle: () => void;
  stackRestartState: ActionState;
  containerStates: Record<string, ActionState>;
  onStackRestart: () => void;
  onContainerRestart: (id: string) => void;
  onViewLogs: (id: string, name: string) => void;
}) {
  const { t } = useTranslation();
  const allRunning = containers.length > 0 && containers.every((c) => c.state === "running");
  const someDown = containers.some((c) => c.state !== "running");

  // Summary counts for the stack header
  const runningCount = containers.filter((c) => c.state === "running").length;
  const totalCount = containers.length;

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
            {runningCount}/{totalCount}
          </Badge>
        </button>

        {/* Stack-level build & restart — now with clear label */}
        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="secondary"
            size="sm"
            onClick={onStackRestart}
            disabled={stackRestartState === "loading" || containers.length === 0}
            className={cn(
              "gap-1 text-xs h-7 px-2",
              stackRestartState === "success" && "text-emerald-400",
              stackRestartState === "error" && "text-red-400",
            )}
            aria-label={`${t("infra.buildRestart")} ${stack.label}`}
            title={t("infra.buildRestartHint")}
          >
            <Icon
              path={stackRestartState === "loading" ? mdiLoading : stackRestartState === "success" ? mdiCheck : mdiRocketLaunchOutline}
              size={0.6}
              className={cn(stackRestartState === "loading" && "animate-spin")}
            />
            {stackRestartState === "loading"
              ? t("infra.building")
              : stackRestartState === "success"
                ? t("infra.buildSuccess")
                : stackRestartState === "error"
                  ? t("infra.buildError")
                  : t("infra.buildRestart")}
          </Button>
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
              onRestart={() => onContainerRestart(c.id)}
              onViewLogs={() => onViewLogs(c.id, c.name)}
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

// ─── Build Status Poller ──────────────────────────────────────────────────

/** A build launched on the host that we are currently tracking. */
interface ActiveBuild {
  buildId: string;
  startedAt: string;
}

/**
 * Polls /admin/stack/:project/build-status for every active build and fires
 * `onResult` when the terminal state is reached (success | failed | stalled).
 * Transient fetch failures are swallowed — this keeps the build observable
 * across the api self-restart that happens when the `dashboard` stack itself
 * is rebuilt.
 *
 * `onReachability(reachable)` fires for every poll cycle so the caller can
 * surface a "Reconnecting…" overlay while the api is down mid-build.
 */
function useBuildStatusPoller(
  activeBuilds: Record<string, ActiveBuild>,
  onResult: (projectName: string, status: StackBuildStatus) => void,
  onReachability: (reachable: boolean) => void,
) {
  // Latest callbacks via ref so the interval doesn't restart on each render.
  const resultRef = useRef(onResult);
  const reachRef = useRef(onReachability);
  resultRef.current = onResult;
  reachRef.current = onReachability;

  useEffect(() => {
    const projects = Object.keys(activeBuilds);
    if (projects.length === 0) {
      reachRef.current(true);
      return;
    }

    let cancelled = false;
    const tick = async () => {
      let anySucceeded = false;
      for (const project of projects) {
        const build = activeBuilds[project];
        if (!build) continue;
        try {
          const status = await fetchJson<StackBuildStatus>(
            `${API_ENDPOINTS.ADMIN_STACK_RESTART}/${project}/build-status?buildId=${encodeURIComponent(build.buildId)}`,
          );
          if (cancelled) return;
          anySucceeded = true;
          resultRef.current(project, status);
        } catch {
          // Keep polling — api may be mid-restart (dashboard stack rebuilds).
        }
      }
      if (!cancelled) reachRef.current(anySucceeded);
    };

    // Kick once immediately so state updates don't wait a full interval.
    void tick();
    const id = setInterval(() => {
      void tick();
    }, BUILD_STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [activeBuilds]);
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

  // Track collapsed stacks — all expanded by default, derived via useMemo
  const [collapsedStacks, setCollapsedStacks] = useState<Set<string>>(
    () => new Set()
  );
  const expandedStacks = useMemo(() => {
    const expanded = new Set<string>();
    for (const stack of stacks) {
      if (!collapsedStacks.has(stack.projectName)) {
        expanded.add(stack.projectName);
      }
    }
    return expanded;
  }, [stacks, collapsedStacks]);

  // Live log viewer target
  const [logTarget, setLogTarget] = useState<LogTarget | null>(null);

  const toggleStack = useCallback((projectName: string) => {
    setCollapsedStacks((prev) => {
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
  const [activeBuilds, setActiveBuilds] = useState<Record<string, ActiveBuild>>({});
  const [reconnecting, setReconnecting] = useState(false);

  // Git states
  const { data: gitStatus, loading: gitStatusLoading, refresh: refreshGitStatus } = useGitStatus();
  const [gitPullState, setGitPullState] = useState<ActionState>("idle");
  const [gitPullMessage, setGitPullMessage] = useState("");

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

  // Called by the build-status poller when a terminal state is reached.
  const handleBuildResult = useCallback(
    (projectName: string, status: StackBuildStatus) => {
      if (status.state === "success") {
        setStackRestart(projectName, "success");
        setActiveBuilds((prev) => {
          if (!prev[projectName]) return prev;
          const next = { ...prev };
          delete next[projectName];
          return next;
        });
        // New containers are up — refresh the list so state badges catch up.
        refresh();
      } else if (status.state === "failed" || status.state === "stalled") {
        setStackRestart(projectName, "error");
        setActiveBuilds((prev) => {
          if (!prev[projectName]) return prev;
          const next = { ...prev };
          delete next[projectName];
          return next;
        });
      }
      // "running" | "unknown" → keep polling
    },
    [refresh, setStackRestart],
  );

  // Reachability callback — if a build is tracking the dashboard stack and
  // the api is unreachable, show the "Reconnecting…" hint.
  const handleReachability = useCallback((reachable: boolean) => {
    setReconnecting(!reachable);
  }, []);

  useBuildStatusPoller(activeBuilds, handleBuildResult, handleReachability);

  /**
   * Stack restart handler — POSTs to /admin/stack/:project/restart.  The
   * endpoint returns immediately after launching a detached build on the
   * host; we then poll build-status until it resolves.
   */
  const handleStackRestart = useCallback(
    async (projectName: string) => {
      setStackRestart(projectName, "loading");
      try {
        const result = await fetchJson<StackBuildStartResult>(
          `${API_ENDPOINTS.ADMIN_STACK_RESTART}/${projectName}/restart`,
          { method: "POST" },
        );
        setActiveBuilds((prev) => ({
          ...prev,
          [projectName]: { buildId: result.buildId, startedAt: result.startedAt },
        }));
      } catch (err) {
        // 409 BUILD_ALREADY_RUNNING means the user's previous build is still
        // in-flight.  We surface it the same as a generic error for now;
        // future work: reattach to the live buildId via a latest-build lookup.
        if (err instanceof ApiErrorException && err.code === "BUILD_ALREADY_RUNNING") {
          setStackRestart(projectName, "error");
          return;
        }
        setStackRestart(projectName, "error");
      }
    },
    [setStackRestart],
  );

  // Open live log viewer for a container
  const handleViewLogs = useCallback((id: string, name: string) => {
    setLogTarget({ id, name });
  }, [setLogTarget]);

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
      refreshGitStatus();
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
  }, [t, refreshGitStatus]);

  return (
    <CollapsiblePanel
      panelKey="infra"
      icon={mdiServerNetwork}
      title={t("infra.title")}
      onRefresh={() => { refresh(); refreshGitStatus(); }}
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
              onStackRestart={() => handleStackRestart(stack.projectName)}
              onContainerRestart={handleContainerRestart}
              onViewLogs={handleViewLogs}
            />
          ))}
        </div>
      )}

      {/* Live Log Viewer — shown below the stack list when a container is selected */}
      {logTarget && (
        <div className="pt-3">
          <ContainerLogViewer
            containerId={logTarget.id}
            containerName={logTarget.name}
            onClose={() => setLogTarget(null)}
          />
        </div>
      )}
    </CollapsiblePanel>
  );
}
