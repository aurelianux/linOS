import { useState, useCallback, useEffect, useRef } from "react";
import {
  mdiWrench,
  mdiRestart,
  mdiSourceBranch,
  mdiCheck,
  mdiLoading,
  mdiArrowUp,
  mdiArrowDown,
  mdiFileEditOutline,
  mdiFileQuestionOutline,
} from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CollapsiblePanel } from "@/components/common/CollapsiblePanel";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { fetchJson } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import { cn } from "@/lib/utils";
import type {
  StackRestartResult,
  GitPullResult,
  GitStatus,
} from "@/lib/api/types";

// ─── Types ────────────────────────────────────────────────────────────────

type ActionState = "idle" | "loading" | "success" | "error";

interface StackRowState {
  state: ActionState;
  error?: string;
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
    <div className="space-y-2 pb-3 border-b border-slate-800">
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

// ─── Stack Row ────────────────────────────────────────────────────────────

function StackRestartRow({
  label,
  rowState,
  onRestart,
}: {
  label: string;
  rowState: StackRowState;
  onRestart: () => void;
}) {
  const { t } = useTranslation();
  const { state, error } = rowState;

  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-800 last:border-0">
      <span className="text-sm font-medium text-slate-200 truncate flex-1 min-w-0">
        {label}
      </span>

      {state === "success" && (
        <span className="text-xs text-emerald-400 shrink-0">
          {t("admin.actions.restartSuccess")}
        </span>
      )}

      {state === "error" && (
        <span className="text-xs text-red-400 shrink-0 truncate max-w-[150px]" title={error}>
          {error ?? t("admin.actions.restartError")}
        </span>
      )}

      <Button
        variant="ghost"
        size="sm"
        onClick={onRestart}
        disabled={state === "loading"}
        className="shrink-0 h-7 w-7 p-0"
        aria-label={`${t("admin.actions.restart")} ${label}`}
      >
        <Icon
          path={state === "loading" ? mdiLoading : state === "success" ? mdiCheck : mdiRestart}
          size={0.7}
          className={cn(
            state === "loading" && "animate-spin text-slate-400",
            state === "success" && "text-emerald-400",
            state === "error" && "text-red-400",
            state === "idle" && "text-slate-400",
          )}
        />
      </Button>
    </div>
  );
}

// ─── Health Poller (for self-restart reconnect) ───────────────────────────

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

// ─── Main Component ──────────────────────────────────────────────────────

export function AdminActionsPanel() {
  const { t } = useTranslation();
  const { data: config } = useDashboardConfig();
  const stacks = config?.adminStacks ?? [];

  // Stack restart states
  const [stackStates, setStackStates] = useState<Record<string, StackRowState>>({});
  const [reconnecting, setReconnecting] = useState(false);

  // Git states
  const [gitStatus, setGitStatus] = useState<GitStatus | null>(null);
  const [gitStatusLoading, setGitStatusLoading] = useState(true);
  const [gitPullState, setGitPullState] = useState<ActionState>("idle");
  const [gitPullMessage, setGitPullMessage] = useState<string>("");

  // Fetch git status
  const fetchGitStatus = useCallback(async () => {
    try {
      const data = await fetchJson<GitStatus>(API_ENDPOINTS.ADMIN_GIT_STATUS);
      setGitStatus(data);
    } catch {
      // Silently fail — git status is informational
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
    setStackStates((prev) => ({
      ...prev,
      dashboard: { state: "success" },
    }));
    setTimeout(() => {
      setStackStates((prev) => ({ ...prev, dashboard: { state: "idle" } }));
    }, 3000);
  }, []);

  useHealthPoller(reconnecting, handleReconnect);

  // Stack restart handler
  const handleStackRestart = useCallback(
    async (projectName: string) => {
      setStackStates((prev) => ({
        ...prev,
        [projectName]: { state: "loading" },
      }));

      try {
        const result = await fetchJson<StackRestartResult>(
          `${API_ENDPOINTS.ADMIN_STACK_RESTART}/${projectName}/restart`,
          { method: "POST" },
        );

        if (result.failed.length > 0) {
          setStackStates((prev) => ({
            ...prev,
            [projectName]: {
              state: "error",
              error: `${t("admin.actions.restartError")}: ${result.failed.join(", ")}`,
            },
          }));
          setTimeout(() => {
            setStackStates((prev) => ({ ...prev, [projectName]: { state: "idle" } }));
          }, 5000);
        } else {
          setStackStates((prev) => ({
            ...prev,
            [projectName]: { state: "success" },
          }));
          setTimeout(() => {
            setStackStates((prev) => ({ ...prev, [projectName]: { state: "idle" } }));
          }, 3000);
        }
      } catch {
        // If this is the dashboard stack, the API may have restarted
        if (projectName === "dashboard") {
          setReconnecting(true);
          setStackStates((prev) => ({
            ...prev,
            [projectName]: { state: "loading" },
          }));
          return;
        }

        setStackStates((prev) => ({
          ...prev,
          [projectName]: { state: "error", error: t("admin.actions.restartError") },
        }));
        setTimeout(() => {
          setStackStates((prev) => ({ ...prev, [projectName]: { state: "idle" } }));
        }, 5000);
      }
    },
    [t],
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
      // Re-fetch git status after pull
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
      panelKey="admin-actions"
      icon={mdiWrench}
      title={t("admin.actions.title")}
    >
      {/* Git Status */}
      <GitStatusSection gitStatus={gitStatus} gitStatusLoading={gitStatusLoading} />

      {/* Git Pull Button */}
      <div className="py-3 border-b border-slate-800">
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
              "text-xs mt-2 truncate",
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
          <span className="text-xs text-amber-400">{t("admin.actions.reconnecting")}</span>
        </div>
      )}

      {/* Stack Restart Buttons */}
      {stacks.length === 0 && (
        <p className="text-sm text-slate-400 py-2">{t("admin.actions.noStacks")}</p>
      )}

      {stacks.length > 0 && (
        <div>
          {stacks.map((stack) => (
            <StackRestartRow
              key={stack.projectName}
              label={stack.label}
              rowState={stackStates[stack.projectName] ?? { state: "idle" }}
              onRestart={() => handleStackRestart(stack.projectName)}
            />
          ))}
        </div>
      )}
    </CollapsiblePanel>
  );
}
