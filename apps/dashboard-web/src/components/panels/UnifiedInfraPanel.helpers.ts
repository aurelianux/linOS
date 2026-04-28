import { useState, useEffect, useLayoutEffect, useRef, useCallback } from "react";
import type { ContainerInfo, AdminStack, StackBuildStatus } from "@/lib/api/types";
import { fetchJson } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";

export const BUILD_STATUS_POLL_MS = 2_000;

export type ActionState = "idle" | "loading" | "success" | "error";

export interface LogTarget { id: string; name: string }

export interface ActiveBuild { buildId: string; startedAt: string }

export const STATE_BADGE_MAP: Record<string, { variant: "success" | "warning" | "destructive" | "secondary"; label: string }> = {
  running: { variant: "success", label: "Running" },
  paused: { variant: "warning", label: "Paused" },
  restarting: { variant: "warning", label: "Restarting" },
  exited: { variant: "destructive", label: "Exited" },
  dead: { variant: "destructive", label: "Dead" },
  created: { variant: "secondary", label: "Created" },
};

export function groupContainersByProject(containers: ContainerInfo[], stacks: AdminStack[]): Map<string, ContainerInfo[]> {
  const grouped = new Map<string, ContainerInfo[]>();
  for (const stack of stacks) grouped.set(stack.projectName, []);
  for (const c of containers) {
    const project = c.project;
    if (project && grouped.has(project)) grouped.get(project)!.push(c);
  }
  return grouped;
}

export function useAutoResetState() {
  const [states, setStates] = useState<Record<string, ActionState>>({});
  const timersRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const setState = useCallback((key: string, state: ActionState) => {
    setStates((prev) => ({ ...prev, [key]: state }));
    if (timersRef.current[key]) clearTimeout(timersRef.current[key]);
    if (state === "success" || state === "error") {
      timersRef.current[key] = setTimeout(() => {
        setStates((prev) => ({ ...prev, [key]: "idle" }));
        delete timersRef.current[key];
      }, state === "success" ? 2000 : 4000);
    }
  }, []);
  return [states, setState] as const;
}

export function useBuildStatusPoller(
  activeBuilds: Record<string, ActiveBuild>,
  onResult: (projectName: string, status: StackBuildStatus) => void,
  onReachability: (reachable: boolean) => void,
) {
  const resultRef = useRef(onResult);
  const reachRef = useRef(onReachability);
  const buildsRef = useRef(activeBuilds);
  useLayoutEffect(() => {
    resultRef.current = onResult;
    reachRef.current = onReachability;
    buildsRef.current = activeBuilds;
  });

  const buildsKey = Object.entries(activeBuilds).map(([p, b]) => `${p}:${b.buildId}`).sort().join(",");

  useEffect(() => {
    if (buildsKey === "") { reachRef.current(true); return; }
    let cancelled = false;
    const tick = async () => {
      const builds = buildsRef.current;
      const projects = Object.keys(builds);
      if (projects.length === 0) return;
      let anySucceeded = false;
      for (const project of projects) {
        const build = builds[project];
        if (!build) continue;
        try {
          const status = await fetchJson<StackBuildStatus>(`${API_ENDPOINTS.ADMIN_STACK_RESTART}/${project}/build-status?buildId=${encodeURIComponent(build.buildId)}`);
          if (cancelled) return;
          anySucceeded = true;
          resultRef.current(project, status);
        } catch { /* keep polling during api self-restart */ }
      }
      if (!cancelled) reachRef.current(anySucceeded);
    };
    void tick();
    const id = setInterval(() => { void tick(); }, BUILD_STATUS_POLL_MS);
    return () => { cancelled = true; clearInterval(id); };
  }, [buildsKey]);
}
