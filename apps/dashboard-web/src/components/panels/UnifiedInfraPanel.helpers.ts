import { useState, useRef, useCallback } from "react";
import type { ContainerInfo, AdminStack } from "@/lib/api/types";

export type ActionState = "idle" | "loading" | "success" | "error";

export interface LogTarget { id: string; name: string }

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
