import { useState, useMemo, useCallback, useEffect } from "react";
import { useEntity, useHass } from "@hakit/core";
import { useVacuumRoutineSocket } from "@/hooks/useVacuumRoutineSocket";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { RoborockConfig, VacuumRoutine } from "@/lib/api/types";
import type { TranslationKey } from "@/lib/i18n/translations";
import type { EditableSegment } from "./VacuumSegmentCard";
import {
  VACUUM_STATE_KEYS, VACUUM_STATE_VARIANTS, ROOM_TRANSLATION_KEYS,
  STARTING_INDICATOR_TIMEOUT_MS,
  getAttr, makeDefaultSegment, routineToSegments, segmentsToSteps, segmentsMatchRoutine,
} from "./VacuumPanel.helpers";

export function useVacuumPanelState(config: RoborockConfig, routines: VacuumRoutine[]) {
  const { t } = useTranslation();
  const { helpers } = useHass();
  const { state: routineState, start, startCustom, pause: pauseRoutine, resume: resumeRoutine, cancel: cancelRoutine } = useVacuumRoutineSocket();
  const entity = useEntity(config.entityId as `vacuum.${string}`, { returnNullIfNotFound: true });

  const isUnavailable = !entity || entity.state === "unavailable" || entity.state === "unknown";
  const vacuumState = entity?.state ?? "unavailable";
  const battery = typeof getAttr(entity, "battery_level") === "number" ? (getAttr(entity, "battery_level") as number) : null;

  const [segments, setSegments] = useState<EditableSegment[]>(() => [makeDefaultSegment()]);
  const [selectedDelay, setSelectedDelay] = useState(0);
  const [prefillId, setPrefillId] = useState<string | null>(null);
  const [isStartPending, setIsStartPending] = useState(false);
  const [nowMs, setNowMs] = useState(0);

  const isCleaning = vacuumState === "cleaning";
  const isPaused = vacuumState === "paused";
  const isDocked = vacuumState === "docked";
  const isError = vacuumState === "error";
  const isVacuumActive = isCleaning || isPaused || vacuumState === "returning";
  const isRoutineActive = !!routineState?.executionState && routineState.executionState !== "idle";
  const showStartingState = isStartPending && !isCleaning && !isError;
  const isActive = isVacuumActive || isRoutineActive || showStartingState;

  const displayState = showStartingState ? "starting" : vacuumState;
  const stateKey = displayState === "starting" ? ("roborock.state.starting" as TranslationKey) : VACUUM_STATE_KEYS[vacuumState];
  const stateLabel = stateKey ? t(stateKey) : vacuumState;
  const stateVariant = displayState === "starting" ? ("default" as const) : (VACUUM_STATE_VARIANTS[vacuumState] ?? "secondary");
  const errorStatus = getAttr(entity, "status") as string | undefined;
  const currentSegment = getAttr(entity, "current_segment") as number | undefined;
  const currentRoomSegment = currentSegment ? config.segments.find((s) => s.id === currentSegment) : undefined;
  const showCurrentRoom = !!currentRoomSegment && !isDocked;
  const roomLabelKey: TranslationKey = isCleaning ? "roborock.currentRoom" : isPaused ? "roborock.pausedIn" : "roborock.location";
  const hasValidSegments = segments.some((s) => s.rooms.length > 0);
  const canStart = !isUnavailable && hasValidSegments && !isActive;
  const scheduledAt = routineState?.scheduledAt;
  const remainingSeconds = scheduledAt && scheduledAt > nowMs ? Math.ceil((scheduledAt - nowMs) / 1000) : 0;

  useEffect(() => {
    if (!scheduledAt) return;
    const tick = () => setNowMs(Date.now());
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [scheduledAt]);

  useEffect(() => {
    if (!isStartPending) return;
    const id = setTimeout(() => setIsStartPending(false), STARTING_INDICATOR_TIMEOUT_MS);
    return () => clearTimeout(id);
  }, [isStartPending]);

  const vacuumTarget = useMemo(() => ({ entity_id: config.entityId }), [config.entityId]);

  const resolveRoomName = useCallback((roomId: string): string => {
    const key = ROOM_TRANSLATION_KEYS[roomId];
    return key ? t(key) : roomId;
  }, [t]);

  const currentStepRooms = useMemo(() => {
    if (!routineState || !isRoutineActive) return "";
    const matchedRoutine = routines.find((r) => r.id === routineState.currentRoutineId);
    const step = matchedRoutine?.steps[routineState.currentStepIndex];
    if (!step) return "";
    return step.segments.map(resolveRoomName).join(", ");
  }, [routineState, isRoutineActive, routines, resolveRoomName]);

  const handlePrefill = useCallback((routine: VacuumRoutine) => {
    setSegments(routineToSegments(routine));
    setPrefillId(routine.id);
    setSelectedDelay(0);
  }, []);

  const handleUpdateSegment = useCallback((index: number, updated: EditableSegment) => {
    setSegments((prev) => prev.map((s, i) => (i === index ? updated : s)));
    setPrefillId(null);
  }, []);

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
      const matchedRoutine = prefillId && routines.find((r) => r.id === prefillId);
      if (matchedRoutine && segmentsMatchRoutine(segments, matchedRoutine)) { await start(matchedRoutine.id, delay); }
      else { await startCustom(steps, delay); }
    } catch (err: unknown) { setIsStartPending(false); console.error("Failed to start vacuum:", err); }
  }, [canStart, segments, selectedDelay, prefillId, routines, start, startCustom]);

  const handlePause = useCallback(async () => {
    try {
      if (isRoutineActive) { await pauseRoutine(); }
      else { helpers.callService({ domain: "vacuum", service: "pause", target: vacuumTarget }); }
    } catch (err: unknown) { console.error("Failed to pause vacuum:", err); }
  }, [isRoutineActive, pauseRoutine, helpers, vacuumTarget]);

  const handleResume = useCallback(async () => {
    try {
      if (isRoutineActive) { await resumeRoutine(); }
      else { helpers.callService({ domain: "vacuum", service: "start", target: vacuumTarget }); }
    } catch (err: unknown) { console.error("Failed to resume vacuum:", err); }
  }, [isRoutineActive, resumeRoutine, helpers, vacuumTarget]);

  const handleStop = useCallback(async () => {
    try {
      if (isRoutineActive) { await cancelRoutine(); }
      else { helpers.callService({ domain: "vacuum", service: "stop", target: vacuumTarget }); }
    } catch (err: unknown) { console.error("Failed to stop vacuum:", err); }
  }, [isRoutineActive, cancelRoutine, helpers, vacuumTarget]);

  const handleDock = useCallback(async () => {
    try { helpers.callService({ domain: "vacuum", service: "return_to_base", target: vacuumTarget }); }
    catch (err: unknown) { console.error("Failed to return vacuum to dock:", err); }
  }, [helpers, vacuumTarget]);

  return {
    t, isUnavailable, vacuumState, battery, isCleaning, isPaused, isDocked, isError,
    isRoutineActive, routineState, showStartingState, isActive, stateLabel, stateVariant,
    errorStatus, currentRoomSegment, showCurrentRoom, roomLabelKey, canStart, remainingSeconds,
    currentStepRooms, resolveRoomName,
    segments, selectedDelay, setSelectedDelay, prefillId,
    handlePrefill, handleUpdateSegment, handleDeleteSegment, handleAddSegment, handleStart,
    handlePause, handleResume, handleStop, handleDock,
  };
}
