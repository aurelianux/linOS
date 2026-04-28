import { mdiRestart, mdiCheck, mdiLoading, mdiChevronDown, mdiTextBoxOutline, mdiRocketLaunchOutline, mdiRefresh, mdiStop } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { cn } from "@/lib/utils";
import type { ContainerInfo, AdminStack, StackAction } from "@/lib/api/types";
import { StateBadge } from "./UnifiedInfraPanel.sections";
import type { ActionState } from "./UnifiedInfraPanel.helpers";

export function ContainerRow({ container, restartState, onRestart, onViewLogs }: {
  container: ContainerInfo; restartState: ActionState; onRestart: () => void; onViewLogs: () => void;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 py-1.5 pl-4">
      <StateBadge state={container.state} />
      <span className="text-sm text-slate-200 truncate min-w-0 flex-1" title={container.name}>{container.name}</span>
      <span className="text-xs text-slate-500 shrink-0 hidden sm:inline tabular-nums">{container.status}</span>
      <button type="button" onClick={onViewLogs} className="shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors" title={t("infra.viewLogs")}>
        <Icon path={mdiTextBoxOutline} size={0.5} /><span className="hidden sm:inline">{t("infra.logs")}</span>
      </button>
      <button type="button" onClick={onRestart} disabled={restartState === "loading"} className={cn("shrink-0 flex items-center gap-1 px-2 py-1 rounded text-xs font-medium transition-colors", restartState === "idle" && "text-slate-400 hover:text-slate-200 hover:bg-slate-800", restartState === "loading" && "text-slate-400 bg-slate-800", restartState === "success" && "text-emerald-400 bg-emerald-900/30", restartState === "error" && "text-red-400 bg-red-900/30")} title={t("infra.restart")}>
        <Icon path={restartState === "loading" ? mdiLoading : restartState === "success" ? mdiCheck : mdiRestart} size={0.5} className={cn(restartState === "loading" && "animate-spin")} />
        <span className="hidden sm:inline">{restartState === "loading" ? t("infra.restarting") : restartState === "success" ? t("infra.restartSuccess") : restartState === "error" ? t("infra.restartError") : t("infra.restart")}</span>
      </button>
    </div>
  );
}

function StackActionButton({ action, state, onClick, disabled }: {
  action: StackAction; state: ActionState; onClick: () => void; disabled?: boolean;
}) {
  const { t } = useTranslation();

  const labels: Record<StackAction, { idle: string; loading: string; success: string; error: string; hint: string }> = {
    build: { idle: t("infra.stackBuild"), loading: t("infra.stackBuilding"), success: t("infra.stackBuildSuccess"), error: t("infra.stackBuildError"), hint: t("infra.stackBuildHint") },
    up:    { idle: t("infra.stackUp"),    loading: t("infra.stackUpping"),    success: t("infra.stackUpSuccess"),    error: t("infra.stackUpError"),    hint: t("infra.stackUpHint") },
    down:  { idle: t("infra.stackDown"),  loading: t("infra.stackDowning"),   success: t("infra.stackDownSuccess"),  error: t("infra.stackDownError"),  hint: t("infra.stackDownHint") },
  };

  const icons: Record<StackAction, string> = {
    build: mdiRocketLaunchOutline,
    up: mdiRefresh,
    down: mdiStop,
  };

  const label = labels[action];
  const iconPath = state === "loading" ? mdiLoading : state === "success" ? mdiCheck : icons[action];
  const text = state === "loading" ? label.loading : state === "success" ? label.success : state === "error" ? label.error : label.idle;

  return (
    <Button
      variant="secondary"
      size="sm"
      onClick={onClick}
      disabled={disabled || state === "loading"}
      className={cn("gap-1 text-xs h-7 px-2", state === "success" && "text-emerald-400", state === "error" && "text-red-400")}
      title={label.hint}
    >
      <Icon path={iconPath} size={0.6} className={cn(state === "loading" && "animate-spin")} />
      <span className="hidden sm:inline">{text}</span>
    </Button>
  );
}

export function StackGroup({ stack, containers, expanded, onToggle, stackActionStates, containerStates, onStackAction, onContainerRestart, onViewLogs }: {
  stack: AdminStack; containers: ContainerInfo[]; expanded: boolean; onToggle: () => void;
  stackActionStates: Record<StackAction, ActionState>; containerStates: Record<string, ActionState>;
  onStackAction: (action: StackAction) => void; onContainerRestart: (id: string) => void; onViewLogs: (id: string, name: string) => void;
}) {
  const allRunning = containers.length > 0 && containers.every((c) => c.state === "running");
  const someDown = containers.some((c) => c.state !== "running");
  const runningCount = containers.filter((c) => c.state === "running").length;
  const anyActionLoading = Object.values(stackActionStates).some((s) => s === "loading");

  return (
    <div className="border-b border-slate-800 last:border-0">
      <div className="flex items-center gap-2 py-2">
        <button type="button" onClick={onToggle} className="flex items-center gap-2 flex-1 min-w-0 hover:bg-slate-800/50 rounded px-1 py-0.5 transition-colors">
          <Icon path={mdiChevronDown} size={0.65} className={cn("text-slate-500 shrink-0 transition-transform duration-200", !expanded && "-rotate-90")} />
          <span className="text-sm font-medium text-slate-100 truncate">{stack.label}</span>
          <Badge variant={containers.length === 0 ? "secondary" : allRunning ? "success" : someDown ? "warning" : "secondary"} className="text-[10px] px-1.5 py-0">
            {runningCount}/{containers.length}
          </Badge>
        </button>
        <div className="flex items-center gap-1 shrink-0">
          <StackActionButton action="build" state={stackActionStates.build ?? "idle"} onClick={() => onStackAction("build")} disabled={anyActionLoading} />
          <StackActionButton action="up"    state={stackActionStates.up ?? "idle"}    onClick={() => onStackAction("up")}    disabled={anyActionLoading} />
          <StackActionButton action="down"  state={stackActionStates.down ?? "idle"}  onClick={() => onStackAction("down")}  disabled={anyActionLoading} />
        </div>
      </div>
      {expanded && containers.length > 0 && (
        <div className="pb-2">
          {containers.map((c) => <ContainerRow key={c.id} container={c} restartState={containerStates[c.id] ?? "idle"} onRestart={() => onContainerRestart(c.id)} onViewLogs={() => onViewLogs(c.id, c.name)} />)}
        </div>
      )}
      {expanded && containers.length === 0 && <p className="text-xs text-slate-500 pl-4 pb-2">No containers</p>}
    </div>
  );
}
