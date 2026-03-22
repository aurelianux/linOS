import { useState, useMemo, useEffect } from "react";
import { useEntity } from "@hakit/core";
import { mdiBattery, mdiPause, mdiStop, mdiHome } from "@mdi/js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import type { RoborockConfig } from "@/lib/api/types";
import type { TranslationKey } from "@/lib/i18n/translations";

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

const FAN_SPEED_TO_POWER: Record<string, number> = {
  silent: 101,
  balanced: 102,
  turbo: 103,
  max: 104,
  custom: 105,
  max_plus: 106,
};

const VACUUM_STATE_KEYS: Record<string, TranslationKey> = {
  docked: "roborock.state.docked",
  cleaning: "roborock.state.cleaning",
  returning: "roborock.state.returning",
  paused: "roborock.state.paused",
  idle: "roborock.state.idle",
  error: "roborock.state.error",
};

const VACUUM_STATE_VARIANTS: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  docked: "secondary",
  cleaning: "success",
  returning: "default",
  paused: "warning",
  idle: "secondary",
  error: "destructive",
};

const ROOM_TRANSLATION_KEYS: Record<string, TranslationKey> = {
  wohnzimmer: "room.wohnzimmer",
  kueche: "room.kueche",
  schlafzimmer: "room.schlafzimmer",
  flur: "room.flur",
  badezimmer: "room.badezimmer",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ToggleChipProps {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToggleChip({ label, selected, disabled, onClick }: ToggleChipProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
        selected
          ? "bg-amber-400/10 text-amber-400 border-amber-400/50"
          : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {label}
    </button>
  );
}

interface SegmentToggleProps {
  options: ReadonlyArray<{ value: number; labelKey: TranslationKey }>;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

function SegmentToggle({ options, value, disabled, onChange }: SegmentToggleProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
            value === opt.value
              ? "bg-slate-700 text-slate-100"
              : "bg-slate-800 text-slate-500 hover:text-slate-400",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {t(opt.labelKey)}
        </button>
      ))}
    </div>
  );
}

// ─── Helper: extract typed attribute ──────────────────────────────────────────

function getAttr(entity: { attributes: Record<string, unknown> } | null, key: string): unknown {
  if (!entity) return undefined;
  return (entity.attributes as Record<string, unknown>)[key];
}

// ─── Panel body ───────────────────────────────────────────────────────────────

interface PanelBodyProps {
  config: RoborockConfig;
}

function RoborockPanelBody({ config }: PanelBodyProps) {
  const { t } = useTranslation();
  const { data: dashConfig } = useDashboardConfig();

  const entity = useEntity(config.entityId as `vacuum.${string}`, {
    returnNullIfNotFound: true,
  });

  const isUnavailable =
    !entity || entity.state === "unavailable" || entity.state === "unknown";

  const vacuumState = entity?.state ?? "unavailable";
  const battery = typeof getAttr(entity, "battery_level") === "number"
    ? (getAttr(entity, "battery_level") as number)
    : null;
  const currentFanSpeed = getAttr(entity, "fan_speed") as string | undefined;

  // ─── Local state ──────────────────────────────────────────────────────────

  const defaultRooms = useMemo(
    () => config.segments.filter((s) => s.defaultSelected).map((s) => s.id),
    [config.segments]
  );

  const [selectedRooms, setSelectedRooms] = useState<number[]>(defaultRooms);
  const [cleaningMode, setCleaningMode] = useState(config.defaultCleaningMode);
  const [fanPower, setFanPower] = useState(config.defaultFanPower);
  const [waterBoxMode, setWaterBoxMode] = useState(config.defaultWaterBoxMode);
  const [hasSyncedFromEntity, setHasSyncedFromEntity] = useState(false);

  // Sync fan speed from entity on first load (read actual device state)
  useEffect(() => {
    if (hasSyncedFromEntity || !currentFanSpeed) return;
    const mappedPower = FAN_SPEED_TO_POWER[currentFanSpeed];
    if (mappedPower) {
      setFanPower(mappedPower);
    }
    setHasSyncedFromEntity(true);
  }, [currentFanSpeed, hasSyncedFromEntity]);

  // ─── Room name resolution (translated) ───────────────────────────────────

  const resolveRoomName = (roomId: string): string => {
    const translationKey = ROOM_TRANSLATION_KEYS[roomId];
    if (translationKey) return t(translationKey);
    // Fallback: look up config room name
    const room = dashConfig?.rooms.find((r) => r.id === roomId);
    return room?.name ?? roomId;
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const toggleRoom = (segmentId: number) => {
    setSelectedRooms((prev) =>
      prev.includes(segmentId)
        ? prev.filter((id) => id !== segmentId)
        : [...prev, segmentId]
    );
  };

  const handleStart = async () => {
    if (!entity || selectedRooms.length === 0 || isUnavailable) return;
    try {
      // Single app_segment_clean command with all settings inline.
      // Avoids timing issues from sequential setFanSpeed + set_water_box_custom_mode
      // and uses the correct Roborock params format ({ segments, repeat, ... }).
      const waterMode = cleaningMode === "vacuum" ? 200 : waterBoxMode;
      await entity.service.sendCommand({
        serviceData: {
          command: "app_segment_clean",
          params: [
            {
              segments: selectedRooms,
              repeat: 1,
              fan_power: fanPower,
              water_box_mode: waterMode,
            },
          ],
        },
      });
    } catch (err: unknown) {
      console.error("Failed to start vacuum:", err);
    }
  };

  const handlePause = async () => {
    if (!entity || isUnavailable) return;
    try {
      await entity.service.pause();
    } catch (err: unknown) {
      console.error("Failed to pause vacuum:", err);
    }
  };

  const handleResume = async () => {
    if (!entity || isUnavailable) return;
    try {
      await entity.service.start();
    } catch (err: unknown) {
      console.error("Failed to resume vacuum:", err);
    }
  };

  const handleStop = async () => {
    if (!entity || isUnavailable) return;
    try {
      await entity.service.stop();
    } catch (err: unknown) {
      console.error("Failed to stop vacuum:", err);
    }
  };

  const handleDock = async () => {
    if (!entity || isUnavailable) return;
    try {
      await entity.service.returnToBase();
    } catch (err: unknown) {
      console.error("Failed to return vacuum to dock:", err);
    }
  };

  // ─── Derived state ────────────────────────────────────────────────────────

  const stateKey = VACUUM_STATE_KEYS[vacuumState];
  const stateLabel = stateKey ? t(stateKey) : vacuumState;
  const stateVariant = VACUUM_STATE_VARIANTS[vacuumState] ?? "secondary";

  const isCleaning = vacuumState === "cleaning";
  const isPaused = vacuumState === "paused";
  const isActive = isCleaning || isPaused || vacuumState === "returning";
  const canStart = !isUnavailable && selectedRooms.length > 0 && !isActive;

  // Current room from entity attributes (Roborock exposes this during cleaning)
  const currentSegment = getAttr(entity, "current_segment") as number | undefined;
  const currentRoomSegment = currentSegment
    ? config.segments.find((s) => s.id === currentSegment)
    : undefined;

  return (
    <div className={cn("space-y-4", isUnavailable && "opacity-50")}>
      {/* Status bar */}
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
      </div>

        {/* Current room indicator when cleaning */}
        {isCleaning && currentRoomSegment && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-400/5 border border-amber-900/50">
            <span className="text-xs text-amber-400">
              {t("roborock.currentRoom")}: {resolveRoomName(currentRoomSegment.roomId)}
            </span>
          </div>
        )}

        {/* Active controls — pause / stop / dock */}
        {isActive && (
          <div className="flex gap-2">
            {isCleaning && (
              <Button
                variant="secondary"
                size="sm"
                className="flex-1"
                onClick={handlePause}
              >
                <Icon path={mdiPause} size={0.7} className="mr-1" />
                {t("roborock.pause")}
              </Button>
            )}
            {isPaused && (
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 bg-amber-500 hover:bg-amber-600 text-slate-950"
                onClick={handleResume}
              >
                {t("roborock.resume")}
              </Button>
            )}
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={handleStop}
            >
              <Icon path={mdiStop} size={0.7} className="mr-1" />
              {t("roborock.stop")}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              className="flex-1"
              onClick={handleDock}
            >
              <Icon path={mdiHome} size={0.7} className="mr-1" />
              {t("roborock.dock")}
            </Button>
          </div>
        )}

        {/* Room selection */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-2">
            {config.segments.map((seg) => (
              <ToggleChip
                key={seg.id}
                label={resolveRoomName(seg.roomId)}
                selected={selectedRooms.includes(seg.id)}
                disabled={isUnavailable || isActive}
                onClick={() => toggleRoom(seg.id)}
              />
            ))}
          </div>
          {selectedRooms.length === 0 && !isUnavailable && !isActive && (
            <p className="text-xs text-amber-400">{t("roborock.noRooms")}</p>
          )}
        </div>

        {/* Cleaning mode toggle */}
        <div className="flex rounded-lg overflow-hidden border border-slate-700">
          <button
            type="button"
            disabled={isUnavailable || isActive}
            onClick={() => setCleaningMode("vacuum")}
            className={cn(
              "flex-1 py-2 text-xs font-medium transition-colors",
              cleaningMode === "vacuum"
                ? "bg-slate-700 text-slate-100"
                : "bg-slate-800 text-slate-500 hover:text-slate-400",
              (isUnavailable || isActive) && "cursor-not-allowed opacity-50"
            )}
          >
            {t("roborock.mode.vacuum")}
          </button>
          <button
            type="button"
            disabled={isUnavailable || isActive}
            onClick={() => setCleaningMode("vacuum_and_mop")}
            className={cn(
              "flex-1 py-2 text-xs font-medium transition-colors border-l border-slate-700",
              cleaningMode === "vacuum_and_mop"
                ? "bg-slate-700 text-slate-100"
                : "bg-slate-800 text-slate-500 hover:text-slate-400",
              (isUnavailable || isActive) && "cursor-not-allowed opacity-50"
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
            value={fanPower}
            disabled={isUnavailable || isActive}
            onChange={setFanPower}
          />
        </div>

        {/* Mop intensity — only in vacuum_and_mop mode */}
        {cleaningMode === "vacuum_and_mop" && (
          <div className="space-y-1">
            <span className="text-xs text-slate-500">{t("roborock.mop")}</span>
            <SegmentToggle
              options={WATER_BOX_OPTIONS}
              value={waterBoxMode}
              disabled={isUnavailable || isActive}
              onChange={setWaterBoxMode}
            />
          </div>
        )}

        {/* Start button — hidden when active */}
        {!isActive && (
          <Button
            className={cn(
              "w-full font-semibold",
              canStart && "bg-amber-500 hover:bg-amber-600 text-slate-950"
            )}
            disabled={!canStart}
            onClick={handleStart}
          >
            {t("roborock.start")}
          </Button>
        )}

        {/* Unavailable message */}
        {isUnavailable && (
          <p className="text-xs text-slate-500 text-center">
            {t("entity.unavailable")}
          </p>
        )}
    </div>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function RoborockQuickPanel() {
  const { data: dashConfig } = useDashboardConfig();

  if (!dashConfig?.roborock) return null;

  return <RoborockPanelBody config={dashConfig.roborock} />;
}
