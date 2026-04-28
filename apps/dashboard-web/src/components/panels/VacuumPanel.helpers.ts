import type { EditableSegment } from "./VacuumSegmentCard";
import type { VacuumRoutine, VacuumRoutineStep } from "@/lib/api/types";
import type { TranslationKey } from "@/lib/i18n/translations";

export const VACUUM_STATE_KEYS: Record<string, TranslationKey> = {
  docked: "roborock.state.docked",
  cleaning: "roborock.state.cleaning",
  returning: "roborock.state.returning",
  paused: "roborock.state.paused",
  idle: "roborock.state.idle",
  error: "roborock.state.error",
};

export const VACUUM_STATE_VARIANTS: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  docked: "secondary",
  cleaning: "success",
  returning: "default",
  paused: "warning",
  idle: "secondary",
  error: "destructive",
};

export const ROOM_TRANSLATION_KEYS: Record<string, TranslationKey> = {
  wohnzimmer: "room.wohnzimmer",
  kueche: "room.kueche",
  schlafzimmer: "room.schlafzimmer",
  flur: "room.flur",
  badezimmer: "room.badezimmer",
};

export const SCHEDULE_PRESETS = [
  { labelKey: "vacuum.schedule.now" as TranslationKey, delayMs: 0 },
  { labelKey: "vacuum.schedule.plus10m" as TranslationKey, delayMs: 10 * 60 * 1000 },
  { labelKey: "vacuum.schedule.plus30m" as TranslationKey, delayMs: 30 * 60 * 1000 },
  { labelKey: "vacuum.schedule.plus1h" as TranslationKey, delayMs: 60 * 60 * 1000 },
  { labelKey: "vacuum.schedule.plus2h" as TranslationKey, delayMs: 2 * 60 * 60 * 1000 },
] as const;

export const STARTING_INDICATOR_TIMEOUT_MS = 15_000;
export const DEFAULT_ROOMS = ["flur", "wohnzimmer"];
export const DEFAULT_MODE: "vacuum" | "vacuum_and_mop" = "vacuum_and_mop";
export const DEFAULT_FAN_POWER = 103;
export const DEFAULT_WATER_BOX_MODE = 202;

export function getAttr(entity: { attributes: Record<string, unknown> } | null, key: string): unknown {
  if (!entity) return undefined;
  return (entity.attributes as Record<string, unknown>)[key];
}

export function makeSegmentId(): string {
  const cryptoObj: Crypto | undefined = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
  if (cryptoObj && typeof cryptoObj.randomUUID === "function") return cryptoObj.randomUUID();
  if (cryptoObj && typeof cryptoObj.getRandomValues === "function") {
    const bytes = new Uint8Array(16);
    cryptoObj.getRandomValues(bytes);
    bytes[6] = ((bytes[6] ?? 0) & 0x0f) | 0x40;
    bytes[8] = ((bytes[8] ?? 0) & 0x3f) | 0x80;
    const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0"));
    return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex.slice(6, 8).join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10, 16).join("")}`;
  }
  return `seg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function makeDefaultSegment(): EditableSegment {
  return {
    id: makeSegmentId(),
    rooms: [...DEFAULT_ROOMS],
    mode: DEFAULT_MODE,
    fanPower: DEFAULT_FAN_POWER,
    waterBoxMode: DEFAULT_WATER_BOX_MODE,
    isEditing: true,
  };
}

export function routineToSegments(routine: VacuumRoutine): EditableSegment[] {
  return routine.steps.map((step) => ({
    id: makeSegmentId(),
    rooms: [...step.segments],
    mode: step.mode,
    fanPower: step.fanPower,
    waterBoxMode: step.waterBoxMode,
    isEditing: false,
  }));
}

export function segmentsToSteps(segments: EditableSegment[]): VacuumRoutineStep[] {
  return segments.map((seg) => ({
    mode: seg.mode,
    segments: seg.rooms,
    fanPower: seg.fanPower,
    waterBoxMode: seg.mode === "vacuum" ? null : seg.waterBoxMode,
  }));
}

export function segmentsMatchRoutine(segments: EditableSegment[], routine: VacuumRoutine): boolean {
  if (segments.length !== routine.steps.length) return false;
  return segments.every((seg, i) => {
    const step = routine.steps[i];
    if (!step) return false;
    return (
      seg.mode === step.mode &&
      seg.fanPower === step.fanPower &&
      seg.waterBoxMode === step.waterBoxMode &&
      seg.rooms.length === step.segments.length &&
      seg.rooms.every((r) => step.segments.includes(r))
    );
  });
}
