import { useState, useCallback, useMemo } from "react";
import { mdiServerNetwork, mdiSourceBranch, mdiLoading } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
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
import { ApiErrorException, type ContainerRestartResult, type StackBuildStartResult, type StackBuildStatus, type GitPullResult } from "@/lib/api/types";
import {
  type ActionState, type LogTarget, type ActiveBuild,
  groupContainersByProject, useAutoResetState, useBuildStatusPoller,
} from "./UnifiedInfraPanel.helpers";
import { GitStatusSection, DockerUnavailableNotice } from "./UnifiedInfraPanel.sections";
import { StackGroup } from "./UnifiedInfraPanel.containers";

export function UnifiedInfraPanel() {
  const { t } = useTranslation();
  const { data: config } = useDashboardConfig();
  const { data: dockerData, loading: dockerLoading, lastUpdated, refresh } = useDockerContainers();
  const stacks = useMemo(() => config?.adminStacks ?? [], [config?.adminStacks]);
  const containers = dockerData?.containers ?? [];

  const [collapsedStacks, setCollapsedStacks] = useState<Set<string>>(() => new Set());
  const expandedStacks = useMemo(() => {
    const expanded = new Set<string>();
    for (const stack of stacks) { if (!collapsedStacks.has(stack.projectName)) expanded.add(stack.projectName); }
    return expanded;
  }, [stacks, collapsedStacks]);
  const toggleStack = useCallback((projectName: string) => {
    setCollapsedStacks((prev) => { const next = new Set(prev); if (next.has(projectName)) next.delete(projectName); else next.add(projectName); return next; });
  }, []);

  const [logTarget, setLogTarget] = useState<LogTarget | null>(null);
  const [containerRestartStates, setContainerRestart] = useAutoResetState();
  const [stackRestartStates, setStackRestart] = useAutoResetState();
  const [stackMessages, setStackMessages] = useState<Record<string, string>>({});
  const [activeBuilds, setActiveBuilds] = useState<Record<string, ActiveBuild>>({});
  const [reconnecting, setReconnecting] = useState(false);
  const { data: gitStatus, loading: gitStatusLoading, refresh: refreshGitStatus } = useGitStatus();
  const [gitPullState, setGitPullState] = useState<ActionState>("idle");
  const [gitPullMessage, setGitPullMessage] = useState("");

  const grouped = groupContainersByProject(containers, stacks);

  const setStackMessage = useCallback((projectName: string, message: string) => {
    setStackMessages((prev) => ({ ...prev, [projectName]: message }));
    if (message) setTimeout(() => { setStackMessages((prev) => { if (prev[projectName] !== message) return prev; const next = { ...prev }; delete next[projectName]; return next; }); }, 4000);
  }, []);

  const handleContainerRestart = useCallback(async (containerId: string) => {
    setContainerRestart(containerId, "loading");
    try { await fetchJson<ContainerRestartResult>(`${API_ENDPOINTS.ADMIN_CONTAINER}/${containerId}/restart`, { method: "POST" }); setContainerRestart(containerId, "success"); }
    catch { setContainerRestart(containerId, "error"); }
  }, [setContainerRestart]);

  const handleBuildResult = useCallback((projectName: string, status: StackBuildStatus) => {
    if (status.state === "success") {
      setStackRestart(projectName, "success");
      setActiveBuilds((prev) => { if (!prev[projectName]) return prev; const next = { ...prev }; delete next[projectName]; return next; });
      refresh(); setTimeout(() => { refresh(); }, 2500);
    } else if (status.state === "failed" || status.state === "stalled") {
      setStackRestart(projectName, "error");
      setActiveBuilds((prev) => { if (!prev[projectName]) return prev; const next = { ...prev }; delete next[projectName]; return next; });
    }
  }, [refresh, setStackRestart]);

  useBuildStatusPoller(activeBuilds, handleBuildResult, useCallback((reachable: boolean) => { setReconnecting(!reachable); }, []));

  const handleStackRestart = useCallback(async (projectName: string) => {
    setStackRestart(projectName, "loading"); setStackMessage(projectName, "");
    try {
      const result = await fetchJson<StackBuildStartResult>(`${API_ENDPOINTS.ADMIN_STACK_RESTART}/${projectName}/restart`, { method: "POST" });
      setActiveBuilds((prev) => ({ ...prev, [projectName]: { buildId: result.buildId, startedAt: result.startedAt } }));
    } catch (err) {
      if (err instanceof ApiErrorException && err.code === "BUILD_ALREADY_RUNNING") { setStackRestart(projectName, "error"); setStackMessage(projectName, t("infra.buildAlreadyRunning")); return; }
      setStackRestart(projectName, "error");
    }
  }, [setStackRestart, setStackMessage, t]);

  const handleGitPull = useCallback(async () => {
    setGitPullState("loading"); setGitPullMessage("");
    try {
      const result = await fetchJson<GitPullResult>(API_ENDPOINTS.ADMIN_GIT_PULL, { method: "POST" });
      setGitPullState("success"); setGitPullMessage(result.stdout); refreshGitStatus();
      setTimeout(() => { setGitPullState("idle"); setGitPullMessage(""); }, 5000);
    } catch { setGitPullState("error"); setGitPullMessage(t("admin.actions.gitPullError")); setTimeout(() => { setGitPullState("idle"); setGitPullMessage(""); }, 5000); }
  }, [t, refreshGitStatus]);

  return (
    <CollapsiblePanel panelKey="infra" icon={mdiServerNetwork} title={t("infra.title")} onRefresh={() => { refresh(); refreshGitStatus(); }} loading={dockerLoading} lastUpdated={lastUpdated}>
      <div className="pb-3 border-b border-slate-800 space-y-3">
        <GitStatusSection gitStatus={gitStatus} gitStatusLoading={gitStatusLoading} />
        <Button variant="secondary" size="sm" onClick={handleGitPull} disabled={gitPullState === "loading"} className="w-full gap-2">
          <Icon path={gitPullState === "loading" ? mdiLoading : mdiSourceBranch} size={0.7} className={cn(gitPullState === "loading" && "animate-spin")} />
          {gitPullState === "loading" ? t("admin.actions.gitPulling") : t("admin.actions.gitPull")}
        </Button>
        {gitPullMessage && <p className={cn("text-xs truncate", gitPullState === "success" && "text-emerald-400", gitPullState === "error" && "text-red-400")} title={gitPullMessage}>{gitPullMessage}</p>}
      </div>
      {reconnecting && <div className="flex items-center gap-2 py-2"><Icon path={mdiLoading} size={0.7} className="text-amber-400 animate-spin" /><span className="text-xs text-amber-400">{t("infra.reconnecting")}</span></div>}
      {dockerData && !dockerData.available && <DockerUnavailableNotice reason={dockerData.unavailableReason ?? "Docker not available."} code={dockerData.unavailableCode ?? null} />}
      {dockerLoading && !dockerData && <LoadingState />}
      {dockerData?.available && stacks.length > 0 && (
        <div className="pt-2">
          {stacks.map((stack) => (
            <StackGroup key={stack.projectName} stack={stack} containers={grouped.get(stack.projectName) ?? []} expanded={expandedStacks.has(stack.projectName)} onToggle={() => toggleStack(stack.projectName)} stackRestartState={stackRestartStates[stack.projectName] ?? "idle"} stackMessage={stackMessages[stack.projectName]} containerStates={containerRestartStates} onStackRestart={() => handleStackRestart(stack.projectName)} onContainerRestart={handleContainerRestart} onViewLogs={(id, name) => setLogTarget({ id, name })} />
          ))}
        </div>
      )}
      {logTarget && (
        <div className="pt-3">
          <ContainerLogViewer containerId={logTarget.id} containerName={logTarget.name} onClose={() => setLogTarget(null)} />
        </div>
      )}
    </CollapsiblePanel>
  );
}
