import { useState, useMemo, useEffect } from "react";
import { useEntity, useHass } from "@hakit/core";
import {
  mdiAlertCircle,
  mdiBattery,
  mdiHome,
  mdiMapMarker,
  mdiPause,
  mdiStop,
} from "@mdi/js";
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

const VACUUM_STATE_VARIANTS: Record<
  string,
  "default" | "success" | "warning" | "destructive" | "secondary"
> = {
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

// ─── Shared UI components ────────────────────────────────────────────────────

import { ToggleChip } from "@/components/ui/toggle-chip";
import { SegmentToggle } from "@/components/ui/segment-toggle";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getAttr(
  entity: { attributes: Record<string, unknown> } | null,
  key: string
): unknown {
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
  const { helpers } = useHass();

  const entity = useEntity(config.entityId as `vacuum.${string}`, {
    returnNullIfNotFound: true,
  });

  const isUnavailable =
    !entity || entity.state === "unavailable" || entity.state === "unknown";

  const vacuumState = entity?.state ?? "unavailable";
  const battery =
    typeof getAttr(entity, "battery_level") === "number"
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
  const [isStarting, setIsStarting] = useState(false);

  // Sync fan speed from entity on first load (read actual device state)
  useEffect(() => {
    if (hasSyncedFromEntity || !currentFanSpeed) return;
    const mappedPower = FAN_SPEED_TO_POWER[currentFanSpeed];
    if (mappedPower) {
      setFanPower(mappedPower);
    }
    setHasSyncedFromEntity(true);
  }, [currentFanSpeed, hasSyncedFromEntity]);

  // Clear optimistic "starting" state once HA confirms cleaning or reports error
  useEffect(() => {
    if (isStarting && (vacuumState === "cleaning" || vacuumState === "error")) {
      setIsStarting(false);
    }
  }, [isStarting, vacuumState]);

  // ─── Room name resolution (translated) ───────────────────────────────────

  const resolveRoomName = (roomId: string): string => {
    const translationKey = ROOM_TRANSLATION_KEYS[roomId];
    if (translationKey) return t(translationKey);
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

  // All service calls use helpers.callService() directly instead of
  // entity.service.* to bypass the @hakit/core entity proxy.

  const vacuumTarget = { entity_id: config.entityId };

  const handleStart = async () => {
    if (!entity || selectedRooms.length === 0 || isUnavailable) return;
    setIsStarting(true);
    try {
      const waterMode = cleaningMode === "vacuum" ? 200 : waterBoxMode;

      // Set fan power + water box mode separately — these fields are NOT
      // supported inline in app_segment_clean (HA Roborock integration
      // rejects unknown params, causing the vacuum to abort and return to dock).
      helpers.callService({
        domain: "vacuum",
        service: "send_command",
        serviceData: { command: "set_custom_mode", params: [fanPower] },
        target: vacuumTarget,
      });
      helpers.callService({
        domain: "vacuum",
        service: "send_command",
        serviceData: { command: "set_water_box_custom_mode", params: [waterMode] },
        target: vacuumTarget,
      });

      // Brief delay for device to process settings
      await new Promise<void>((resolve) => setTimeout(resolve, 500));

      // Start segment clean — ONLY segments + repeat (the format that works in HA Dev Tools)
      helpers.callService({
        domain: "vacuum",
        service: "send_command",
        serviceData: {
          command: "app_segment_clean",
          params: [{ segments: selectedRooms, repeat: 1 }],
        },
        target: vacuumTarget,
      });
    } catch (err: unknown) {
      setIsStarting(false);
      console.error("Failed to start vacuum:", err);
    }
  };

  const handlePause = async () => {
    if (!entity || isUnavailable) return;
    try {
      helpers.callService({
        domain: "vacuum",
        service: "pause",
        target: vacuumTarget,
      });
    } catch (err: unknown) {
      console.error("Failed to pause vacuum:", err);
    }
  };

  const handleResume = async () => {
    if (!entity || isUnavailable) return;
    try {
      helpers.callService({
        domain: "vacuum",
        service: "start",
        target: vacuumTarget,
      });
    } catch (err: unknown) {
      console.error("Failed to resume vacuum:", err);
    }
  };

  const handleStop = async () => {
    if (!entity || isUnavailable) return;
    try {
      helpers.callService({
        domain: "vacuum",
        service: "stop",
        target: vacuumTarget,
      });
    } catch (err: unknown) {
      console.error("Failed to stop vacuum:", err);
    }
  };

  const handleDock = async () => {
    if (!entity || isUnavailable) return;
    try {
      helpers.callService({
        domain: "vacuum",
        service: "return_to_base",
        target: vacuumTarget,
      });
    } catch (err: unknown) {
      console.error("Failed to return vacuum to dock:", err);
    }
  };

  // ─── Derived state ────────────────────────────────────────────────────────

  const isCleaning = vacuumState === "cleaning";
  const isPaused = vacuumState === "paused";
  const isDocked = vacuumState === "docked";
  const isError = vacuumState === "error";
  const isActive =
    isCleaning || isPaused || vacuumState === "returning" || isStarting;
  const canStart = !isUnavailable && selectedRooms.length > 0 && !isActive;

  // Status badge: optimistic "starting" while waiting for HA confirmation
  const displayState =
    isStarting && !isCleaning ? "starting" : vacuumState;
  const stateKey =
    displayState === "starting"
      ? ("roborock.state.starting" as TranslationKey)
      : VACUUM_STATE_KEYS[vacuumState];
  const stateLabel = stateKey ? t(stateKey) : vacuumState;
  const stateVariant =
    displayState === "starting"
      ? ("default" as const)
      : (VACUUM_STATE_VARIANTS[vacuumState] ?? "secondary");

  // Current room from entity attributes
  const currentSegment = getAttr(entity, "current_segment") as
    | number
    | undefined;
  const currentRoomSegment = currentSegment
    ? config.segments.find((s) => s.id === currentSegment)
    : undefined;

  // Show room whenever vacuum is not docked and segment info is available
  const showCurrentRoom = !!currentRoomSegment && !isDocked;
  const roomLabelKey: TranslationKey = isCleaning
    ? "roborock.currentRoom"
    : isPaused
      ? "roborock.pausedIn"
      : "roborock.location";

  // Error details from entity attributes (Roborock exposes a status string)
  const errorStatus = getAttr(entity, "status") as string | undefined;

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

      {/* Error details */}
      {isError && errorStatus && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-red-400/5 border border-red-900/50">
          <Icon
            path={mdiAlertCircle}
            size={0.7}
            className="text-red-400 shrink-0"
          />
          <span className="text-xs text-red-400">{errorStatus}</span>
        </div>
      )}

      {/* Current room — shown whenever not docked and segment is known */}
      {showCurrentRoom && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-400/5 border border-amber-900/50">
          <Icon
            path={mdiMapMarker}
            size={0.7}
            className="text-amber-400 shrink-0"
          />
          <span className="text-xs text-amber-400">
            {t(roomLabelKey)}: {resolveRoomName(currentRoomSegment.roomId)}
          </span>
        </div>
      )}

      {/* Active controls — pause / resume / stop / dock */}
      {isActive && !isStarting && (
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
              className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-950"
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

      {/* Starting indicator */}
      {isStarting && (
        <div className="w-full py-3 rounded-lg text-sm font-semibold text-center bg-slate-800 text-slate-400 border border-slate-700 animate-pulse">
          {t("roborock.state.starting")}
        </div>
      )}

      {/* Dock button when idle/error away from dock */}
      {!isDocked && !isUnavailable && !isActive && (
        <Button
          variant="secondary"
          size="sm"
          className="w-full"
          onClick={handleDock}
        >
          <Icon path={mdiHome} size={0.7} className="mr-1" />
          {t("roborock.dock")}
        </Button>
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
        <button
          type="button"
          disabled={!canStart}
          onClick={handleStart}
          className={cn(
            "w-full py-3 rounded-lg text-sm font-semibold transition-all duration-200",
            "border select-none",
            canStart
              ? "bg-amber-400 text-slate-950 border-amber-400 hover:bg-amber-300 active:bg-amber-500"
              : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
          )}
        >
          {t("roborock.start")}
        </button>
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

// ─── Vacuum active hook (for auto-expanding panel) ────────────────────────────

/**
 * Returns true when the vacuum is actively cleaning, paused, or returning.
 * Used by SmarthomePage to force-expand the vacuum panel during activity.
 */
export function useIsVacuumActive(
  entityId: string | undefined
): boolean {
  const entity = useEntity(
    (entityId ?? "vacuum._none_") as `vacuum.${string}`,
    { returnNullIfNotFound: true }
  );
  if (!entityId) return false;
  const state = entity?.state;
  return state === "cleaning" || state === "paused" || state === "returning";
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function RoborockQuickPanel() {
  const { data: dashConfig } = useDashboardConfig();

  if (!dashConfig?.roborock) return null;

  return <RoborockPanelBody config={dashConfig.roborock} />;
}
