import { useState, useMemo, useCallback, useEffect } from "react";
import { useEntity, useHass } from "@hakit/core";
import {
  mdiAlertCircle,
  mdiBattery,
  mdiHome,
  mdiMapMarker,
  mdiPause,
  mdiPlay,
  mdiPlus,
  mdiStop,
} from "@mdi/js";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useVacuumRoutineSocket } from "@/hooks/useVacuumRoutineSocket";
import {
  VacuumSegmentCard,
  type EditableSegment,
} from "./VacuumSegmentCard";
import type {
  RoborockConfig,
  VacuumRoutine,
  VacuumRoutineStep,
} from "@/lib/api/types";
import type { TranslationKey } from "@/lib/i18n/translations";

// ─── Constants ────────────────────────────────────────────────────────────────

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

const SCHEDULE_PRESETS = [
  { labelKey: "vacuum.schedule.now" as TranslationKey, delayMs: 0 },
  { labelKey: "vacuum.schedule.plus10m" as TranslationKey, delayMs: 10 * 60 * 1000 },
  { labelKey: "vacuum.schedule.plus30m" as TranslationKey, delayMs: 30 * 60 * 1000 },
  { labelKey: "vacuum.schedule.plus1h" as TranslationKey, delayMs: 60 * 60 * 1000 },
  { labelKey: "vacuum.schedule.plus2h" as TranslationKey, delayMs: 2 * 60 * 60 * 1000 },
] as const;

const STARTING_INDICATOR_TIMEOUT_MS = 15_000;

const DEFAULT_ROOMS = ["flur", "wohnzimmer"];
const DEFAULT_MODE: "vacuum" | "vacuum_and_mop" = "vacuum_and_mop";
const DEFAULT_FAN_POWER = 103;
const DEFAULT_WATER_BOX_MODE = 202;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getAttr(
  entity: { attributes: Record<string, unknown> } | null,
  key: string
): unknown {
  if (!entity) return undefined;
  return (entity.attributes as Record<string, unknown>)[key];
}

function makeSegmentId(): string {
  return crypto.randomUUID();
}

function makeDefaultSegment(): EditableSegment {
  return {
    id: makeSegmentId(),
    rooms: [...DEFAULT_ROOMS],
    mode: DEFAULT_MODE,
    fanPower: DEFAULT_FAN_POWER,
    waterBoxMode: DEFAULT_WATER_BOX_MODE,
    isEditing: true,
  };
}

function routineToSegments(routine: VacuumRoutine): EditableSegment[] {
  return routine.steps.map((step) => ({
    id: makeSegmentId(),
    rooms: [...step.segments],
    mode: step.mode,
    fanPower: step.fanPower,
    waterBoxMode: step.waterBoxMode,
    isEditing: false,
  }));
}

function segmentsToSteps(segments: EditableSegment[]): VacuumRoutineStep[] {
  return segments.map((seg) => ({
    mode: seg.mode,
    segments: seg.rooms,
    fanPower: seg.fanPower,
    waterBoxMode: seg.mode === "vacuum" ? null : seg.waterBoxMode,
  }));
}

function segmentsMatchRoutine(
  segments: EditableSegment[],
  routine: VacuumRoutine
): boolean {
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

// ─── Panel body ──────────────────────────────────────────────────────────────

interface PanelBodyProps {
  config: RoborockConfig;
  routines: VacuumRoutine[];
}

function VacuumPanelBody({ config, routines }: PanelBodyProps) {
  const { t } = useTranslation();
  const { helpers } = useHass();
  const {
    state: routineState,
    start,
    startCustom,
    pause: pauseRoutine,
    resume: resumeRoutine,
    cancel: cancelRoutine,
  } = useVacuumRoutineSocket();

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

  // ─── Local state ──────────────────────────────────────────────────────────

  const [segments, setSegments] = useState<EditableSegment[]>([
    makeDefaultSegment(),
  ]);
  const [selectedDelay, setSelectedDelay] = useState(0);
  const [prefillId, setPrefillId] = useState<string | null>(null);
  const [isStartPending, setIsStartPending] = useState(false);

  // ─── Derived state ────────────────────────────────────────────────────────

  const isCleaning = vacuumState === "cleaning";
  const isPaused = vacuumState === "paused";
  const isDocked = vacuumState === "docked";
  const isError = vacuumState === "error";
  const isVacuumActive =
    isCleaning || isPaused || vacuumState === "returning";

  const isRoutineActive =
    !!routineState?.executionState &&
    routineState.executionState !== "idle";

  // Derive starting visual state — pending flag is true until timeout or vacuum
  // transitions to cleaning/error (no synchronous setState in an effect needed)
  const showStartingState = isStartPending && !isCleaning && !isError;
  const isActive = isVacuumActive || isRoutineActive || showStartingState;

  const displayState = showStartingState ? "starting" : vacuumState;
  const stateKey =
    displayState === "starting"
      ? ("roborock.state.starting" as TranslationKey)
      : VACUUM_STATE_KEYS[vacuumState];
  const stateLabel = stateKey ? t(stateKey) : vacuumState;
  const stateVariant =
    displayState === "starting"
      ? ("default" as const)
      : (VACUUM_STATE_VARIANTS[vacuumState] ?? "secondary");

  const errorStatus = getAttr(entity, "status") as string | undefined;

  const currentSegment = getAttr(entity, "current_segment") as
    | number
    | undefined;
  const currentRoomSegment = currentSegment
    ? config.segments.find((s) => s.id === currentSegment)
    : undefined;
  const showCurrentRoom = !!currentRoomSegment && !isDocked;

  const roomLabelKey: TranslationKey = isCleaning
    ? "roborock.currentRoom"
    : isPaused
      ? "roborock.pausedIn"
      : "roborock.location";

  const hasValidSegments = segments.some((s) => s.rooms.length > 0);
  const canStart = !isUnavailable && hasValidSegments && !isActive;

  // ─── Scheduled countdown ──────────────────────────────────────────────────

  const scheduledAt = routineState?.scheduledAt;
  const [nowMs, setNowMs] = useState(0);

  useEffect(() => {
    if (!scheduledAt) return;
    const tick = () => setNowMs(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scheduledAt]);

  const remainingSeconds =
    scheduledAt && scheduledAt > nowMs
      ? Math.ceil((scheduledAt - nowMs) / 1000)
      : 0;

  // ─── Starting timeout ─────────────────────────────────────────────────────

  useEffect(() => {
    if (!isStartPending) return;
    const id = setTimeout(() => setIsStartPending(false), STARTING_INDICATOR_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [isStartPending]);

  // ─── Room name resolution ─────────────────────────────────────────────────

  const resolveRoomName = useCallback(
    (roomId: string): string => {
      const key = ROOM_TRANSLATION_KEYS[roomId];
      return key ? t(key) : roomId;
    },
    [t]
  );

  // ─── Current step room names (for routine progress) ───────────────────────

  const currentStepRooms = useMemo(() => {
    if (!routineState || !isRoutineActive) return "";
    const matchedRoutine = routines.find(
      (r) => r.id === routineState.currentRoutineId
    );
    const step = matchedRoutine?.steps[routineState.currentStepIndex];
    if (!step) return "";
    return step.segments.map(resolveRoomName).join(", ");
  }, [routineState, isRoutineActive, routines, resolveRoomName]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const vacuumTarget = useMemo(
    () => ({ entity_id: config.entityId }),
    [config.entityId]
  );

  const handlePrefill = useCallback(
    (routine: VacuumRoutine) => {
      setSegments(routineToSegments(routine));
      setPrefillId(routine.id);
      setSelectedDelay(0);
    },
    []
  );

  const handleUpdateSegment = useCallback(
    (index: number, updated: EditableSegment) => {
      setSegments((prev) => prev.map((s, i) => (i === index ? updated : s)));
      setPrefillId(null);
    },
    []
  );

  const handleDeleteSegment = useCallback((index: number) => {
    setSegments((prev) => prev.filter((_, i) => i !== index));
    setPrefillId(null);
  }, []);

  const handleAddSegment = useCallback(() => {
    setSegments((prev) => [...prev, makeDefaultSegment()]);
    setPrefillId(null);
  }, []);

  const handleStart = useCallback(async () => {
    if (!canStart) return;
    setIsStartPending(true);
    try {
      const steps = segmentsToSteps(segments);
      const delay = selectedDelay > 0 ? selectedDelay : undefined;

      // If segments still match a prefilled routine, use the routine ID endpoint
      const matchedRoutine =
        prefillId && routines.find((r) => r.id === prefillId);
      if (matchedRoutine && segmentsMatchRoutine(segments, matchedRoutine)) {
        await start(matchedRoutine.id, delay);
      } else {
        await startCustom(steps, delay);
      }
    } catch (err: unknown) {
      setIsStartPending(false);
      console.error("Failed to start vacuum:", err);
    }
  }, [canStart, segments, selectedDelay, prefillId, routines, start, startCustom]);

  const handlePause = useCallback(async () => {
    try {
      if (isRoutineActive) {
        await pauseRoutine();
      } else {
        helpers.callService({
          domain: "vacuum",
          service: "pause",
          target: vacuumTarget,
        });
      }
    } catch (err: unknown) {
      console.error("Failed to pause vacuum:", err);
    }
  }, [isRoutineActive, pauseRoutine, helpers, vacuumTarget]);

  const handleResume = useCallback(async () => {
    try {
      if (isRoutineActive) {
        await resumeRoutine();
      } else {
        helpers.callService({
          domain: "vacuum",
          service: "start",
          target: vacuumTarget,
        });
      }
    } catch (err: unknown) {
      console.error("Failed to resume vacuum:", err);
    }
  }, [isRoutineActive, resumeRoutine, helpers, vacuumTarget]);

  const handleStop = useCallback(async () => {
    try {
      if (isRoutineActive) {
        await cancelRoutine();
      } else {
        helpers.callService({
          domain: "vacuum",
          service: "stop",
          target: vacuumTarget,
        });
      }
    } catch (err: unknown) {
      console.error("Failed to stop vacuum:", err);
    }
  }, [isRoutineActive, cancelRoutine, helpers, vacuumTarget]);

  const handleDock = useCallback(async () => {
    try {
      helpers.callService({
        domain: "vacuum",
        service: "return_to_base",
        target: vacuumTarget,
      });
    } catch (err: unknown) {
      console.error("Failed to return vacuum to dock:", err);
    }
  }, [helpers, vacuumTarget]);

  // ─── Render ───────────────────────────────────────────────────────────────

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
        {isRoutineActive && routineState && remainingSeconds > 0 && (
          <span className="text-xs text-slate-400">
            {t("roborock.start")}:{" "}
            <span className="text-sky-400">{remainingSeconds}s</span>
          </span>
        )}
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

      {/* Current room */}
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

      {/* Active controls — pause / resume / stop / dock + step progress */}
      {isActive && !showStartingState && (
        <div className="space-y-3">
          {/* Step progress */}
          {isRoutineActive && routineState && (
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-200">
                  {t("vacuum.stepProgress", {
                    current: String((routineState.currentStepIndex ?? 0) + 1),
                    total: String(routineState.totalSteps),
                  })}
                </span>
              </div>
              {currentStepRooms && (
                <p className="text-xs text-slate-400 mt-1">{currentStepRooms}</p>
              )}
            </div>
          )}

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
                <Icon path={mdiPlay} size={0.7} className="mr-1" />
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
        </div>
      )}

      {/* Starting indicator */}
      {showStartingState && (
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

      {/* ─── Builder section (hidden when active) ────────────────────────── */}
      {!isActive && (
        <>
          {/* Prefill buttons */}
          {routines.length > 0 && (
            <div className="flex gap-2">
              {routines.map((routine) => (
                <button
                  key={routine.id}
                  type="button"
                  disabled={isUnavailable}
                  onClick={() => handlePrefill(routine)}
                  className={cn(
                    "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    "border select-none",
                    prefillId === routine.id
                      ? "bg-slate-700 text-slate-100 border-slate-500"
                      : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200",
                    isUnavailable && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {routine.label}
                </button>
              ))}
            </div>
          )}

          {/* Segment cards */}
          <div className="space-y-2">
            {segments.map((seg, i) => (
              <VacuumSegmentCard
                key={seg.id}
                segment={seg}
                index={i}
                canDelete={segments.length > 1}
                disabled={isUnavailable}
                config={config}
                onUpdate={(updated) => handleUpdateSegment(i, updated)}
                onDelete={() => handleDeleteSegment(i)}
              />
            ))}
          </div>

          {/* Add segment button */}
          <button
            type="button"
            disabled={isUnavailable}
            onClick={handleAddSegment}
            className={cn(
              "w-full py-2 rounded-lg text-xs font-medium transition-colors",
              "border border-dashed border-slate-700 text-slate-500",
              "hover:border-slate-500 hover:text-slate-400",
              isUnavailable && "opacity-50 cursor-not-allowed"
            )}
          >
            <Icon path={mdiPlus} size={0.55} className="mr-1 inline-block align-middle" />
            {t("vacuum.addSegment")}
          </button>

          {/* Schedule bar */}
          <div className="space-y-1.5">
            <span className="text-xs text-slate-500">{t("vacuum.scheduleStart")}</span>
            <div className="flex flex-wrap gap-1.5">
              {SCHEDULE_PRESETS.map((preset) => (
                <button
                  key={preset.delayMs}
                  type="button"
                  disabled={isUnavailable}
                  onClick={() => setSelectedDelay(preset.delayMs)}
                  className={cn(
                    "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                    selectedDelay === preset.delayMs
                      ? "bg-slate-700 text-slate-100"
                      : "bg-slate-800 text-slate-500 hover:text-slate-400",
                    isUnavailable && "opacity-50 cursor-not-allowed"
                  )}
                >
                  {t(preset.labelKey)}
                </button>
              ))}
            </div>
          </div>

          {/* Start button */}
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
        </>
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

export function VacuumPanel() {
  const { data: dashConfig } = useDashboardConfig();

  if (!dashConfig?.roborock) return null;

  const routines = dashConfig.vacuum?.routines ?? [];

  return <VacuumPanelBody config={dashConfig.roborock} routines={routines} />;
}
