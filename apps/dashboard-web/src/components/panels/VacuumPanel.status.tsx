import { mdiAlertCircle, mdiBattery, mdiMapMarker } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { TranslationKey } from "@/lib/i18n/translations";

export function VacuumStatusBar({ battery, stateLabel, stateVariant, isScheduled, remainingSeconds }: {
  battery: number | null;
  stateLabel: string;
  stateVariant: "default" | "success" | "warning" | "destructive" | "secondary";
  isScheduled: boolean;
  remainingSeconds: number;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center justify-between gap-2">
      <div className="flex items-center gap-2">
        {battery !== null && (
          <span className="flex items-center gap-0.5 text-xs text-slate-400">
            <Icon path={mdiBattery} size={0.6} />
            {battery}%
          </span>
        )}
        <Badge variant={stateVariant}>{stateLabel}</Badge>
      </div>
      {isScheduled && (
        <span className="text-xs text-slate-400">
          {t("roborock.start")}:{" "}
          <span className="text-sky-400">{remainingSeconds}s</span>
        </span>
      )}
    </div>
  );
}

export function VacuumErrorNotice({ errorStatus }: { errorStatus: string }) {
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-400/5 border border-red-900/50">
      <Icon path={mdiAlertCircle} size={0.7} className="text-red-400 shrink-0" />
      <span className="text-xs text-red-400">{errorStatus}</span>
    </div>
  );
}

export function VacuumCurrentRoom({ roomLabelKey, segment, resolveRoomName }: {
  roomLabelKey: TranslationKey;
  segment: { roomId: string };
  resolveRoomName: (id: string) => string;
}) {
  const { t } = useTranslation();
  return (
    <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-400/5 border border-amber-900/50">
      <Icon path={mdiMapMarker} size={0.7} className="text-amber-400 shrink-0" />
      <span className="text-xs text-amber-400">
        {t(roomLabelKey)}: {resolveRoomName(segment.roomId)}
      </span>
    </div>
  );
}
