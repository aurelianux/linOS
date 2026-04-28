import { mdiChevronDown, mdiChevronUp, mdiCheck, mdiDelete } from "@mdi/js";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { SegmentToggle } from "@/components/ui/segment-toggle";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { RoborockConfig } from "@/lib/api/types";
import type { EditableSegment } from "./VacuumSegmentCard.helpers";
import { FAN_POWER_OPTIONS, WATER_BOX_OPTIONS } from "./VacuumSegmentCard.helpers";

interface EditingViewProps {
  segment: EditableSegment;
  index: number;
  canDelete: boolean;
  config: RoborockConfig;
  resolveRoomName: (roomId: string) => string;
  onUpdate: (segment: EditableSegment) => void;
  onDelete: () => void;
  onCollapse: () => void;
  onSave: () => void;
  onSetMode: (mode: "vacuum" | "vacuum_and_mop") => void;
  onToggleRoom: (roomId: string) => void;
}

export function VacuumSegmentEditingView({
  segment, index, canDelete, config, resolveRoomName,
  onUpdate, onDelete, onCollapse, onSave, onSetMode, onToggleRoom,
}: EditingViewProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-lg border border-slate-600 bg-slate-800/70 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-400">{t("vacuum.segment")} {index + 1}</p>
        <button type="button" onClick={onCollapse} className="p-1 text-slate-400">
          <Icon path={segment.isEditing ? mdiChevronUp : mdiChevronDown} size={0.7} />
        </button>
      </div>

      <div className="flex flex-wrap gap-2">
        {config.segments.map((seg) => (
          <ToggleChip key={seg.id} label={resolveRoomName(seg.roomId)} selected={segment.rooms.includes(seg.roomId)} onClick={() => onToggleRoom(seg.roomId)} />
        ))}
      </div>
      {segment.rooms.length === 0 && <p className="text-xs text-amber-400">{t("roborock.noRooms")}</p>}

      <div className="flex rounded-lg overflow-hidden border border-slate-700">
        <button type="button" onClick={() => onSetMode("vacuum")} className={cn("flex-1 py-2 text-xs font-medium transition-colors", segment.mode === "vacuum" ? "bg-slate-700 text-slate-100" : "bg-slate-800 text-slate-500 hover:text-slate-400")}>
          {t("roborock.mode.vacuum")}
        </button>
        <button type="button" onClick={() => onSetMode("vacuum_and_mop")} className={cn("flex-1 py-2 text-xs font-medium transition-colors border-l border-slate-700", segment.mode === "vacuum_and_mop" ? "bg-slate-700 text-slate-100" : "bg-slate-800 text-slate-500 hover:text-slate-400")}>
          {t("roborock.mode.vacuumAndMop")}
        </button>
      </div>

      <div className="space-y-1">
        <span className="text-xs text-slate-500">{t("roborock.suction")}</span>
        <SegmentToggle options={FAN_POWER_OPTIONS} value={segment.fanPower} onChange={(v) => onUpdate({ ...segment, fanPower: v })} />
      </div>

      {segment.mode === "vacuum_and_mop" && (
        <div className="space-y-1">
          <span className="text-xs text-slate-500">{t("roborock.mop")}</span>
          <SegmentToggle options={WATER_BOX_OPTIONS} value={segment.waterBoxMode ?? 200} onChange={(v) => onUpdate({ ...segment, waterBoxMode: v })} />
        </div>
      )}

      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="secondary" className="flex-1" disabled={segment.rooms.length === 0} onClick={onSave}>
          <Icon path={mdiCheck} size={0.65} className="mr-1" />{t("vacuum.save")}
        </Button>
        {canDelete && (
          <Button size="sm" variant="ghost" className="text-slate-500 hover:text-red-400" onClick={onDelete}>
            <Icon path={mdiDelete} size={0.65} />
          </Button>
        )}
      </div>
    </div>
  );
}
