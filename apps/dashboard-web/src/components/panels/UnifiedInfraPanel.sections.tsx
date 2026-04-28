import { mdiSourceBranch, mdiLoading, mdiArrowUp, mdiArrowDown, mdiFileEditOutline, mdiFileQuestionOutline, mdiAlertCircleOutline } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { GitStatus } from "@/lib/api/types";
import { STATE_BADGE_MAP } from "./UnifiedInfraPanel.helpers";

export function StateBadge({ state }: { state: string }) {
  const info = STATE_BADGE_MAP[state] ?? { variant: "secondary" as const, label: state };
  return <Badge variant={info.variant} className="text-[10px] px-1.5 py-0 capitalize">{info.label}</Badge>;
}

export function GitStatusSection({ gitStatus, gitStatusLoading }: { gitStatus: GitStatus | null; gitStatusLoading: boolean }) {
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
        {gitStatus.ahead > 0 && <span className="flex items-center gap-0.5 text-xs text-sky-400"><Icon path={mdiArrowUp} size={0.5} />{gitStatus.ahead} {t("admin.actions.gitAhead")}</span>}
        {gitStatus.behind > 0 && <span className="flex items-center gap-0.5 text-xs text-amber-400"><Icon path={mdiArrowDown} size={0.5} />{gitStatus.behind} {t("admin.actions.gitBehind")}</span>}
      </div>
      <div className="text-xs text-slate-400 truncate" title={gitStatus.lastCommit.message}>
        <span className="font-mono text-slate-300">{gitStatus.lastCommit.hash}</span>{" "}{gitStatus.lastCommit.message}{" — "}<span className="text-slate-500">{gitStatus.lastCommit.relativeTime}</span>
      </div>
      {hasDirty ? (
        <div className="flex items-center gap-3 text-xs">
          {gitStatus.dirty > 0 && <span className="flex items-center gap-1 text-amber-400"><Icon path={mdiFileEditOutline} size={0.5} />{gitStatus.dirty} {t("admin.actions.gitDirty")}</span>}
          {gitStatus.untracked > 0 && <span className="flex items-center gap-1 text-slate-500"><Icon path={mdiFileQuestionOutline} size={0.5} />{gitStatus.untracked} {t("admin.actions.gitUntracked")}</span>}
        </div>
      ) : (
        <span className="text-xs text-emerald-400">{t("admin.actions.gitClean")}</span>
      )}
    </div>
  );
}

export function DockerUnavailableNotice({ reason, code }: { reason: string; code: string | null }) {
  const { t } = useTranslation();
  const showSocketHint = code === "SOCKET_NOT_FOUND";
  return (
    <div className="space-y-3 py-2">
      <div className="flex items-start gap-2">
        <Icon path={mdiAlertCircleOutline} size={1} className="text-amber-400 shrink-0 mt-0.5" />
        <p className="text-sm text-amber-400">{reason}</p>
      </div>
      {showSocketHint && (
        <>
          <p className="text-xs text-slate-500">{t("docker.socketHint")} <code className="bg-slate-800 px-1 rounded text-slate-300">docker-compose.yml</code>:</p>
          <pre className="text-xs bg-slate-800 text-slate-300 rounded px-3 py-2 overflow-x-auto">{"<HOST_DOCKER_SOCKET>:/var/run/docker.sock:ro"}</pre>
        </>
      )}
    </div>
  );
}
