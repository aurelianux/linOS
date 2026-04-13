import {
  mdiPencil,
  mdiDelete,
  mdiCheck,
  mdiChevronDown,
  mdiChevronUp,
} from "@mdi/js";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { SegmentToggle } from "@/components/ui/segment-toggle";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { RoborockConfig } from "@/lib/api/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const FAN_POWER_OPTIONS = [
  { value: 101, labelKey: "roborock.suction.silent" as TranslationKey },
  { value: 102, labelKey: "roborock.suction.balanced" as TranslationKey },
  { value: 103, labelKey: "roborock.suction.turbo" as TranslationKey },
  { value: 104, labelKey: "roborock.suction.max" as TranslationKey },
  { value: 105, labelKey: "roborock.suction.custom" as TranslationKey },
  { value: 106, labelKey: "roborock.suction.maxPlus" as TranslationKey },
] as const;

const WATER_BOX_OPTIONS = [
  { value: 200, labelKey: "roborock.mop.off" as TranslationKey },
  { value: 201, labelKey: "roborock.mop.low" as TranslationKey },
  { value: 202, labelKey: "roborock.mop.medium" as TranslationKey },
  { value: 203, labelKey: "roborock.mop.high" as TranslationKey },
] as const;

const ROOM_TRANSLATION_KEYS: Record<string, TranslationKey> = {
  wohnzimmer: "room.wohnzimmer",
  kueche: "room.kueche",
  schlafzimmer: "room.schlafzimmer",
  flur: "room.flur",
  badezimmer: "room.badezimmer",
};

// ─── Types ────────────────────────────────────────────────────────────────────

export interface EditableSegment {
  id: string;
  rooms: string[];
  mode: "vacuum" | "vacuum_and_mop";
  fanPower: number;
  waterBoxMode: number | null;
  isEditing: boolean;
}

interface VacuumSegmentCardProps {
  segment: EditableSegment;
  index: number;
  canDelete: boolean;
  disabled: boolean;
  config: RoborockConfig;
  onUpdate: (segment: EditableSegment) => void;
  onDelete: () => void;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fanPowerLabel(value: number): TranslationKey | null {
  const opt = FAN_POWER_OPTIONS.find((o) => o.value === value);
  return opt?.labelKey ?? null;
}

function waterBoxLabel(value: number | null): TranslationKey | null {
  if (value === null) return null;
  const opt = WATER_BOX_OPTIONS.find((o) => o.value === value);
  return opt?.labelKey ?? null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function VacuumSegmentCard({
  segment,
  index,
  canDelete,
  disabled,
  config,
  onUpdate,
  onDelete,
}: VacuumSegmentCardProps) {
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
    onUpdate({
      ...segment,
      mode,
      waterBoxMode: mode === "vacuum" ? null : (segment.waterBoxMode ?? 202),
    });
  };

  const handleSave = () => onUpdate({ ...segment, isEditing: false });
  const handleEdit = () => onUpdate({ ...segment, isEditing: true });

  const roomNames = segment.rooms.map(resolveRoomName).join(", ");
  const modeLabel = t(
    segment.mode === "vacuum_and_mop"
      ? "roborock.mode.vacuumAndMop"
      : "roborock.mode.vacuum"
  );
  const suctionKey = fanPowerLabel(segment.fanPower);
  const suctionLabel = suctionKey ? t(suctionKey) : String(segment.fanPower);
  const mopKey = waterBoxLabel(segment.waterBoxMode);
  const mopLabel = mopKey ? t(mopKey) : null;

  // ─── Collapsed view ───────────────────────────────────────────────────────

  if (!segment.isEditing) {
    return (
      <div
        className={cn(
          "rounded-lg border border-slate-700 bg-slate-800/50 p-3",
          disabled && "opacity-50"
        )}
      >
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-400">
              {t("vacuum.segment")} {index + 1}
            </p>
            <p className="text-sm text-slate-200 truncate">
              {roomNames || "—"}
            </p>
            <p className="text-xs text-slate-500 truncate">
              {modeLabel} · {suctionLabel}
              {mopLabel ? ` · ${mopLabel}` : ""}
            </p>
          </div>
          {!disabled && (
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={handleEdit}
                className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-700 transition-colors"
                title={t("vacuum.edit")}
              >
                <Icon path={mdiPencil} size={0.65} />
              </button>
              {canDelete && (
                <button
                  type="button"
                  onClick={onDelete}
                  className="p-1 rounded text-slate-500 hover:text-red-400 hover:bg-slate-700 transition-colors"
                  title={t("vacuum.delete")}
                >
                  <Icon path={mdiDelete} size={0.65} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ─── Expanded (editing) view ──────────────────────────────────────────────

  return (
    <div className="rounded-lg border border-slate-600 bg-slate-800/70 p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium text-slate-400">
          {t("vacuum.segment")} {index + 1}
        </p>
        <button
          type="button"
          onClick={handleEdit}
          className="p-1 text-slate-400"
        >
          <Icon path={segment.isEditing ? mdiChevronUp : mdiChevronDown} size={0.7} />
        </button>
      </div>

      {/* Room selection */}
      <div className="flex flex-wrap gap-2">
        {config.segments.map((seg) => (
          <ToggleChip
            key={seg.id}
            label={resolveRoomName(seg.roomId)}
            selected={segment.rooms.includes(seg.roomId)}
            onClick={() => toggleRoom(seg.roomId)}
          />
        ))}
      </div>
      {segment.rooms.length === 0 && (
        <p className="text-xs text-amber-400">{t("roborock.noRooms")}</p>
      )}

      {/* Mode toggle */}
      <div className="flex rounded-lg overflow-hidden border border-slate-700">
        <button
          type="button"
          onClick={() => setMode("vacuum")}
          className={cn(
            "flex-1 py-2 text-xs font-medium transition-colors",
            segment.mode === "vacuum"
              ? "bg-slate-700 text-slate-100"
              : "bg-slate-800 text-slate-500 hover:text-slate-400"
          )}
        >
          {t("roborock.mode.vacuum")}
        </button>
        <button
          type="button"
          onClick={() => setMode("vacuum_and_mop")}
          className={cn(
            "flex-1 py-2 text-xs font-medium transition-colors border-l border-slate-700",
            segment.mode === "vacuum_and_mop"
              ? "bg-slate-700 text-slate-100"
              : "bg-slate-800 text-slate-500 hover:text-slate-400"
          )}
        >
          {t("roborock.mode.vacuumAndMop")}
        </button>
      </div>

      {/* Suction power */}
      <div className="space-y-1">
        <span className="text-xs text-slate-500">{t("roborock.suction")}</span>
        <SegmentToggle
          options={FAN_POWER_OPTIONS}
          value={segment.fanPower}
          onChange={(v) => onUpdate({ ...segment, fanPower: v })}
        />
      </div>

      {/* Mop intensity — only in vacuum_and_mop mode */}
      {segment.mode === "vacuum_and_mop" && (
        <div className="space-y-1">
          <span className="text-xs text-slate-500">{t("roborock.mop")}</span>
          <SegmentToggle
            options={WATER_BOX_OPTIONS}
            value={segment.waterBoxMode ?? 200}
            onChange={(v) => onUpdate({ ...segment, waterBoxMode: v })}
          />
        </div>
      )}

      {/* Save + Delete row */}
      <div className="flex gap-2 pt-1">
        <Button
          size="sm"
          variant="secondary"
          className="flex-1"
          disabled={segment.rooms.length === 0}
          onClick={handleSave}
        >
          <Icon path={mdiCheck} size={0.65} className="mr-1" />
          {t("vacuum.save")}
        </Button>
        {canDelete && (
          <Button
            size="sm"
            variant="ghost"
            className="text-slate-500 hover:text-red-400"
            onClick={onDelete}
          >
            <Icon path={mdiDelete} size={0.65} />
          </Button>
        )}
      </div>
    </div>
  );
}
