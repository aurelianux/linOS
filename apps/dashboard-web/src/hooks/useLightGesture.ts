import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import {
  type GestureDirection,
  type UseLightGestureOptions,
  type UseLightGestureResult,
  HINT_DELAY_MS,
  brightnessToPercent,
  computeMoveOutcome,
} from "./useLightGesture.helpers.js";

export type { GestureDirection };

export function useLightGesture({
  cardRef, isOn, brightness, isUnavailable, presetCount,
  onBrightnessCommit, onColorSelect, onTurnOff,
}: UseLightGestureOptions): UseLightGestureResult {
  const [showHints, setShowHints] = useState(false);
  const [direction, setDirection] = useState<GestureDirection>("none");
  const [dragBrightness, setDragBrightness] = useState<number | null>(null);
  const [colorIndex, setColorIndex] = useState<number | null>(null);

  const dotRefs = useRef<(HTMLDivElement | null)[]>([]);
  const activePointerId = useRef<number | null>(null);
  const startY = useRef(0);
  const startX = useRef(0);
  const startBrightness = useRef(0);
  const directionLocked = useRef<GestureDirection>("none");
  const hintTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetGesture = useCallback(() => {
    setShowHints(false);
    setDirection("none");
    setDragBrightness(null);
    setColorIndex(null);
    directionLocked.current = "none";
    activePointerId.current = null;
    if (hintTimer.current) { clearTimeout(hintTimer.current); hintTimer.current = null; }
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activePointerId.current !== null) {
        cardRef.current?.releasePointerCapture(activePointerId.current);
        resetGesture();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, [resetGesture, cardRef]);

  const onPointerDown = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (isUnavailable) return;
    e.preventDefault();
    cardRef.current?.setPointerCapture(e.pointerId);
    activePointerId.current = e.pointerId;
    startY.current = e.clientY;
    startX.current = e.clientX;
    startBrightness.current = isOn ? brightnessToPercent(brightness) : 0;
    directionLocked.current = "none";
    setDirection("none"); setDragBrightness(null); setColorIndex(null); setShowHints(false);
    hintTimer.current = setTimeout(() => { setShowHints(true); hintTimer.current = null; }, HINT_DELAY_MS);
  }, [isUnavailable, brightness, isOn, cardRef]);

  const onPointerMove = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerId.current === null || e.pointerId !== activePointerId.current) return;
    if (e.pointerType === "mouse" && e.buttons === 0) return;
    if (isUnavailable) return;

    const dy = startY.current - e.clientY;
    const dx = e.clientX - startX.current;
    const outcome = computeMoveOutcome(
      dy, dx, directionLocked.current, presetCount, isOn,
      startBrightness.current, e.clientX, dotRefs.current
    );

    if (outcome.kind === "lock") {
      if (hintTimer.current) { clearTimeout(hintTimer.current); hintTimer.current = null; }
      setShowHints(false);
      directionLocked.current = outcome.direction;
      setDirection(outcome.direction);
      if (outcome.initialColorIndex !== null) setColorIndex(outcome.initialColorIndex);
    } else if (outcome.kind === "brightness") {
      setDragBrightness(outcome.value);
    } else if (outcome.kind === "color") {
      setColorIndex(outcome.index);
    }
  }, [isUnavailable, isOn, presetCount]);

  const onPointerUp = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    if (activePointerId.current === null) return;
    const dir = directionLocked.current;
    const currentDragBrightness = dragBrightness;
    const currentColorIndex = colorIndex;
    cardRef.current?.releasePointerCapture(e.pointerId);
    if (dir === "vertical" && currentDragBrightness !== null) onBrightnessCommit(currentDragBrightness);
    else if (dir === "left" && currentColorIndex !== null) onColorSelect?.(currentColorIndex);
    else if (dir === "right") onTurnOff?.();
    resetGesture();
  }, [cardRef, dragBrightness, colorIndex, onBrightnessCommit, onColorSelect, onTurnOff, resetGesture]);

  const onPointerCancel = useCallback((e: ReactPointerEvent<HTMLDivElement>) => {
    cardRef.current?.releasePointerCapture(e.pointerId);
    resetGesture();
  }, [cardRef, resetGesture]);

  const onLostPointerCapture = useCallback(() => { resetGesture(); }, [resetGesture]);

  return {
    showHints, direction, dragBrightness, colorIndex, dotRefs,
    handlers: { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture },
  };
}
