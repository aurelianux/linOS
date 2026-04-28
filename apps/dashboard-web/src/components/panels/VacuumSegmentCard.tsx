import { mdiPencil, mdiDelete } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import {
  type EditableSegment,
  type VacuumSegmentCardProps,
  ROOM_TRANSLATION_KEYS,
  fanPowerLabel,
  waterBoxLabel,
} from "./VacuumSegmentCard.helpers";
import { VacuumSegmentEditingView } from "./VacuumSegmentCard.views";

export type { EditableSegment };

export function VacuumSegmentCard({ segment, index, canDelete, disabled, config, onUpdate, onDelete }: VacuumSegmentCardProps) {
  const { t } = useTranslation();

  const resolveRoomName = (roomId: string): string => {
    const key = ROOM_TRANSLATION_KEYS[roomId];
    return key ? t(key) : roomId;
  };

  const toggleRoom = (roomId: string) => {
    const rooms = segment.rooms.includes(roomId)
      ? segment.rooms.filter((r) => r !== roomId)
      : [...segment.rooms, roomId];
    onUpdate({ ...segment, rooms });
  };

  const setMode = (mode: "vacuum" | "vacuum_and_mop") => {
    onUpdate({ ...segment, mode, waterBoxMode: mode === "vacuum" ? null : (segment.waterBoxMode ?? 202) });
  };

  const roomNames = segment.rooms.map(resolveRoomName).join(", ");
  const modeLabel = t(segment.mode === "vacuum_and_mop" ? "roborock.mode.vacuumAndMop" : "roborock.mode.vacuum");
  const suctionKey = fanPowerLabel(segment.fanPower);
  const suctionLabel = suctionKey ? t(suctionKey) : String(segment.fanPower);
  const mopKey = waterBoxLabel(segment.waterBoxMode);
  const mopLabel = mopKey ? t(mopKey) : null;

  if (!segment.isEditing) {
    return (
      <div className={cn("rounded-lg border border-slate-700 bg-slate-800/50 p-3", disabled && "opacity-50")}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-400">{t("vacuum.segment")} {index + 1}</p>
            <p className="text-sm text-slate-200 truncate">{roomNames || "—"}</p>
            <p className="text-xs text-slate-500 truncate">{modeLabel} · {suctionLabel}{mopLabel ? ` · ${mopLabel}` : ""}</p>
          </div>
          {!disabled && (
            <div className="flex items-center gap-1 shrink-0">
              <button type="button" onClick={() => onUpdate({ ...segment, isEditing: true })} className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors" title={t("vacuum.edit")}>
                <Icon path={mdiPencil} size={0.65} />
              </button>
              {canDelete && (
                <button type="button" onClick={onDelete} className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors" title={t("vacuum.delete")}>
                  <Icon path={mdiDelete} size={0.65} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <VacuumSegmentEditingView
      segment={segment} index={index} canDelete={canDelete} config={config}
      resolveRoomName={resolveRoomName} onUpdate={onUpdate} onDelete={onDelete}
      onCollapse={() => onUpdate({ ...segment, isEditing: true })}
      onSave={() => onUpdate({ ...segment, isEditing: false })}
      onSetMode={setMode}
      onToggleRoom={toggleRoom}
    />
  );
}
