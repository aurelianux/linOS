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
import type { ContainerRestartResult, StackActionResult, GitPullResult, StackAction } from "@/lib/api/types";
import {
  type ActionState, type LogTarget,
  groupContainersByProject, useAutoResetState,
} from "./UnifiedInfraPanel.helpers";
import { GitStatusSection, DockerUnavailableNotice } from "./UnifiedInfraPanel.sections";
import { StackGroup } from "./UnifiedInfraPanel.containers";

type StackActionStates = Record<StackAction, ActionState>;

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
  const [stackActionStates, setStackAction] = useState<Record<string, StackActionStates>>({});
  const { data: gitStatus, loading: gitStatusLoading, refresh: refreshGitStatus } = useGitStatus();
  const [gitPullState, setGitPullState] = useState<ActionState>("idle");
  const [gitPullMessage, setGitPullMessage] = useState("");

  const grouped = groupContainersByProject(containers, stacks);

  const setStackActionState = useCallback((projectName: string, action: StackAction, state: ActionState) => {
    setStackAction((prev) => ({
      ...prev,
      [projectName]: { ...(prev[projectName] ?? { build: "idle", up: "idle", down: "idle" }), [action]: state },
    }));
    if (state === "success" || state === "error") {
      const delay = state === "success" ? 2000 : 4000;
      setTimeout(() => {
        setStackAction((prev) => ({
          ...prev,
          [projectName]: { ...(prev[projectName] ?? { build: "idle", up: "idle", down: "idle" }), [action]: "idle" },
        }));
      }, delay);
    }
  }, []);

  const handleContainerRestart = useCallback(async (containerId: string) => {
    setContainerRestart(containerId, "loading");
    try { await fetchJson<ContainerRestartResult>(`${API_ENDPOINTS.ADMIN_CONTAINER}/${containerId}/restart`, { method: "POST" }); setContainerRestart(containerId, "success"); }
    catch { setContainerRestart(containerId, "error"); }
  }, [setContainerRestart]);

  const handleStackAction = useCallback(async (projectName: string, action: StackAction) => {
    setStackActionState(projectName, action, "loading");
    try {
      await fetchJson<StackActionResult>(`${API_ENDPOINTS.ADMIN_STACK_ACTION}/${projectName}/action`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });
      setStackActionState(projectName, action, "success");
      if (action !== "build") { refresh(); setTimeout(() => refresh(), 2500); }
    } catch {
      setStackActionState(projectName, action, "error");
    }
  }, [setStackActionState, refresh]);

  const handleGitPull = useCallback(async () => {
    setGitPullState("loading"); setGitPullMessage("");
    try {
      const result = await fetchJson<GitPullResult>(API_ENDPOINTS.ADMIN_GIT_PULL, { method: "POST" });
      setGitPullState("success"); setGitPullMessage(result.stdout); refreshGitStatus();
      setTimeout(() => { setGitPullState("idle"); setGitPullMessage(""); }, 5000);
    } catch { setGitPullState("error"); setGitPullMessage(t("admin.actions.gitPullError")); setTimeout(() => { setGitPullState("idle"); setGitPullMessage(""); }, 5000); }
  }, [t, refreshGitStatus]);

  const IDLE_STACK_STATES: StackActionStates = { build: "idle", up: "idle", down: "idle" };

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
      {dockerData && !dockerData.available && <DockerUnavailableNotice reason={dockerData.unavailableReason ?? "Docker not available."} code={dockerData.unavailableCode ?? null} />}
      {dockerLoading && !dockerData && <LoadingState />}
      {dockerData?.available && stacks.length > 0 && (
        <div className="pt-2">
          {stacks.map((stack) => (
            <StackGroup
              key={stack.projectName}
              stack={stack}
              containers={grouped.get(stack.projectName) ?? []}
              expanded={expandedStacks.has(stack.projectName)}
              onToggle={() => toggleStack(stack.projectName)}
              stackActionStates={stackActionStates[stack.projectName] ?? IDLE_STACK_STATES}
              containerStates={containerRestartStates}
              onStackAction={(action) => handleStackAction(stack.projectName, action)}
              onContainerRestart={handleContainerRestart}
              onViewLogs={(id, name) => setLogTarget({ id, name })}
            />
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
