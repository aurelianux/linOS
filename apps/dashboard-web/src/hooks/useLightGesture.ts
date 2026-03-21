import { useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, RefObject, MutableRefObject } from "react";

export type GestureDirection = "none" | "vertical" | "left" | "right";

const CARD_HEIGHT = 140;
const DRAG_THRESHOLD = 8;
const DIRECTION_LOCK_THRESHOLD = 12;
const HINT_DELAY_MS = 150;

function brightnessToPercent(b: number): number {
  return Math.round((b / 255) * 100);
}

/** Find the dot index whose center is closest to clientX using actual DOM rects. */
function findClosestDot(
  clientX: number,
  dots: (HTMLDivElement | null)[]
): number {
  let closest = 0;
  let minDist = Infinity;
  for (let i = 0; i < dots.length; i++) {
    const dot = dots[i];
    if (!dot) continue;
    const rect = dot.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const dist = Math.abs(clientX - center);
    if (dist < minDist) {
      minDist = dist;
      closest = i;
    }
  }
  return closest;
}

interface UseLightGestureOptions {
  cardRef: RefObject<HTMLDivElement | null>;
  isOn: boolean;
  brightness: number;
  isUnavailable: boolean;
  presetCount: number;
  onBrightnessCommit: (percent: number) => void;
  onBrightnessLive?: (percent: number) => void;
  onColorSelect?: (index: number) => void;
  onTurnOff?: () => void;
}

interface UseLightGestureResult {
  showHints: boolean;
  direction: GestureDirection;
  dragBrightness: number | null;
  colorIndex: number | null;
  dotRefs: MutableRefObject<(HTMLDivElement | null)[]>;
  handlers: {
    onPointerDown: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerMove: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerUp: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onPointerCancel: (e: ReactPointerEvent<HTMLDivElement>) => void;
    onLostPointerCapture: (e: ReactPointerEvent<HTMLDivElement>) => void;
  };
}

export function useLightGesture({
  cardRef,
  isOn,
  brightness,
  isUnavailable,
  presetCount,
  onBrightnessCommit,
  onBrightnessLive,
  onColorSelect,
  onTurnOff,
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
  const lastLiveCall = useRef(0);

  // Stable refs for callbacks that change frequently
  const onBrightnessLiveRef = useRef(onBrightnessLive);
  onBrightnessLiveRef.current = onBrightnessLive;
  const onBrightnessCommitRef = useRef(onBrightnessCommit);
  onBrightnessCommitRef.current = onBrightnessCommit;
  const onColorSelectRef = useRef(onColorSelect);
  onColorSelectRef.current = onColorSelect;
  const onTurnOffRef = useRef(onTurnOff);
  onTurnOffRef.current = onTurnOff;

  const resetGesture = useCallback(() => {
    setShowHints(false);
    setDirection("none");
    setDragBrightness(null);
    setColorIndex(null);
    directionLocked.current = "none";
    activePointerId.current = null;
    lastLiveCall.current = 0;
    if (hintTimer.current) {
      clearTimeout(hintTimer.current);
      hintTimer.current = null;
    }
  }, []);

  // Escape key cancels gesture
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape" && activePointerId.current !== null) {
        const el = cardRef.current;
        if (el && activePointerId.current !== null) {
          el.releasePointerCapture(activePointerId.current);
        }
        resetGesture();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [resetGesture, cardRef]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (hintTimer.current) clearTimeout(hintTimer.current);
    };
  }, []);

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (isUnavailable) return;
      e.preventDefault();

      const el = cardRef.current;
      if (el) el.setPointerCapture(e.pointerId);

      activePointerId.current = e.pointerId;
      startY.current = e.clientY;
      startX.current = e.clientX;
      startBrightness.current = isOn ? brightnessToPercent(brightness) : 0;
      directionLocked.current = "none";
      lastLiveCall.current = 0;

      setDirection("none");
      setDragBrightness(null);
      setColorIndex(null);
      setShowHints(false);

      // Delayed hint display — quick taps produce zero visual change
      hintTimer.current = setTimeout(() => {
        setShowHints(true);
        hintTimer.current = null;
      }, HINT_DELAY_MS);
    },
    [isUnavailable, brightness, isOn, cardRef]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      // Bug fix: ignore hover (no active press) and wrong pointer
      if (activePointerId.current === null) return;
      if (e.pointerId !== activePointerId.current) return;
      if (e.pointerType === "mouse" && e.buttons === 0) return;
      if (isUnavailable) return;

      const dy = startY.current - e.clientY;
      const dx = e.clientX - startX.current;
      const absDy = Math.abs(dy);
      const absDx = Math.abs(dx);

      // Phase 1: Detect and lock direction
      if (directionLocked.current === "none") {
        const dist = Math.sqrt(dy * dy + dx * dx);
        if (dist < DRAG_THRESHOLD) return;

        if (dist >= DIRECTION_LOCK_THRESHOLD) {
          // Cancel hint timer — direction is now known
          if (hintTimer.current) {
            clearTimeout(hintTimer.current);
            hintTimer.current = null;
          }
          setShowHints(false);

          if (absDy > absDx) {
            directionLocked.current = "vertical";
          } else if (dx < -DIRECTION_LOCK_THRESHOLD && presetCount > 0) {
            directionLocked.current = "left";
          } else if (dx > DIRECTION_LOCK_THRESHOLD && isOn) {
            directionLocked.current = "right";
          }
          setDirection(directionLocked.current);

          // Bug fix: compute initial colorIndex when locking to "left"
          if (directionLocked.current === "left") {
            const dots = dotRefs.current;
            // Dots may not be mounted yet on this frame — will be set on next move
            if (dots.length > 0 && dots[0]) {
              setColorIndex(findClosestDot(e.clientX, dots));
            }
          }
        }
        return;
      }

      // Phase 2: Active drag in locked direction
      if (directionLocked.current === "vertical") {
        const sensitivity = CARD_HEIGHT;
        const delta = (dy / sensitivity) * 100;
        const newPercent = Math.max(1, Math.min(100, startBrightness.current + delta));
        const rounded = Math.round(newPercent);
        setDragBrightness(rounded);

        // Throttled live brightness update
        const now = Date.now();
        if (onBrightnessLiveRef.current && now - lastLiveCall.current >= 150) {
          lastLiveCall.current = now;
          onBrightnessLiveRef.current(rounded);
        }
      } else if (directionLocked.current === "left") {
        const dots = dotRefs.current;
        if (dots.length > 0 && dots[0]) {
          setColorIndex(findClosestDot(e.clientX, dots));
        }
      }
      // "right": no continuous tracking needed
    },
    [isUnavailable, isOn, presetCount]
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (activePointerId.current === null) return;

      // Read refs BEFORE releasing capture — releasePointerCapture may
      // synchronously fire lostpointercapture → resetGesture → clear refs
      const dir = directionLocked.current;
      const currentDragBrightness = dragBrightness;
      const currentColorIndex = colorIndex;

      const el = cardRef.current;
      if (el) el.releasePointerCapture(e.pointerId);

      if (dir === "vertical" && currentDragBrightness !== null) {
        onBrightnessCommitRef.current(currentDragBrightness);
      } else if (dir === "left" && currentColorIndex !== null) {
        onColorSelectRef.current?.(currentColorIndex);
      } else if (dir === "right") {
        onTurnOffRef.current?.();
      }
      // dir === "none" (tap): do nothing

      resetGesture();
    },
    [cardRef, dragBrightness, colorIndex, resetGesture]
  );

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = cardRef.current;
      if (el && activePointerId.current !== null) {
        el.releasePointerCapture(e.pointerId);
      }
      resetGesture();
    },
    [cardRef, resetGesture]
  );

  const onLostPointerCapture = useCallback(
    (_e: ReactPointerEvent<HTMLDivElement>) => {
      resetGesture();
    },
    [resetGesture]
  );

  return {
    showHints,
    direction,
    dragBrightness,
    colorIndex,
    dotRefs,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel,
      onLostPointerCapture,
    },
  };
}
