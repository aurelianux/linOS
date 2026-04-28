import type { TranslationKey } from "@/lib/i18n/translations";
import type { RoborockConfig } from "@/lib/api/types";

export const FAN_POWER_OPTIONS = [
  { value: 101, labelKey: "roborock.suction.silent" as TranslationKey },
  { value: 102, labelKey: "roborock.suction.balanced" as TranslationKey },
  { value: 103, labelKey: "roborock.suction.turbo" as TranslationKey },
  { value: 104, labelKey: "roborock.suction.max" as TranslationKey },
  { value: 105, labelKey: "roborock.suction.custom" as TranslationKey },
  { value: 106, labelKey: "roborock.suction.maxPlus" as TranslationKey },
] as const;

export const WATER_BOX_OPTIONS = [
  { value: 200, labelKey: "roborock.mop.off" as TranslationKey },
  { value: 201, labelKey: "roborock.mop.low" as TranslationKey },
  { value: 202, labelKey: "roborock.mop.medium" as TranslationKey },
  { value: 203, labelKey: "roborock.mop.high" as TranslationKey },
] as const;

export const ROOM_TRANSLATION_KEYS: Record<string, TranslationKey> = {
  wohnzimmer: "room.wohnzimmer",
  kueche: "room.kueche",
  schlafzimmer: "room.schlafzimmer",
  flur: "room.flur",
  badezimmer: "room.badezimmer",
};

export interface EditableSegment {
  id: string;
  rooms: string[];
  mode: "vacuum" | "vacuum_and_mop";
  fanPower: number;
  waterBoxMode: number | null;
  isEditing: boolean;
}

export interface VacuumSegmentCardProps {
  segment: EditableSegment;
  index: number;
  canDelete: boolean;
  disabled: boolean;
  config: RoborockConfig;
  onUpdate: (segment: EditableSegment) => void;
  onDelete: () => void;
}

export function fanPowerLabel(value: number): TranslationKey | null {
  return FAN_POWER_OPTIONS.find((o) => o.value === value)?.labelKey ?? null;
}

export function waterBoxLabel(value: number | null): TranslationKey | null {
  if (value === null) return null;
  return WATER_BOX_OPTIONS.find((o) => o.value === value)?.labelKey ?? null;
}
