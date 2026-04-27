import type { MutableRefObject } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";

export type GestureDirection = "none" | "vertical" | "left" | "right";

export const CARD_HEIGHT = 140;
export const DRAG_THRESHOLD = 8;
export const DIRECTION_LOCK_THRESHOLD = 12;
export const HINT_DELAY_MS = 150;

export function brightnessToPercent(b: number): number {
  return Math.round((b / 255) * 100);
}

export function findClosestDot(clientX: number, dots: (HTMLDivElement | null)[]): number {
  let closest = 0;
  let minDist = Infinity;
  for (let i = 0; i < dots.length; i++) {
    const dot = dots[i];
    if (!dot) continue;
    const rect = dot.getBoundingClientRect();
    const center = rect.left + rect.width / 2;
    const dist = Math.abs(clientX - center);
    if (dist < minDist) { minDist = dist; closest = i; }
  }
  return closest;
}

export interface UseLightGestureOptions {
  cardRef: React.RefObject<HTMLDivElement | null>;
  isOn: boolean;
  brightness: number;
  isUnavailable: boolean;
  presetCount: number;
  onBrightnessCommit: (percent: number) => void;
  onColorSelect?: (index: number) => void;
  onTurnOff?: () => void;
}

export interface UseLightGestureResult {
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

export type MoveOutcome =
  | { kind: "ignore" }
  | { kind: "pending" }
  | { kind: "lock"; direction: GestureDirection; initialColorIndex: number | null }
  | { kind: "brightness"; value: number }
  | { kind: "color"; index: number };

export function computeMoveOutcome(
  dy: number,
  dx: number,
  directionLocked: GestureDirection,
  presetCount: number,
  isOn: boolean,
  startBrightness: number,
  clientX: number,
  dots: (HTMLDivElement | null)[]
): MoveOutcome {
  const absDy = Math.abs(dy);
  const absDx = Math.abs(dx);

  if (directionLocked === "none") {
    const dist = Math.sqrt(dy * dy + dx * dx);
    if (dist < DRAG_THRESHOLD) return { kind: "pending" };
    if (dist < DIRECTION_LOCK_THRESHOLD) return { kind: "pending" };

    let direction: GestureDirection = "none";
    if (absDy > absDx) direction = "vertical";
    else if (dx < -DIRECTION_LOCK_THRESHOLD && presetCount > 0) direction = "left";
    else if (dx > DIRECTION_LOCK_THRESHOLD && isOn) direction = "right";

    const initialColorIndex =
      direction === "left" && dots.length > 0 && dots[0]
        ? findClosestDot(clientX, dots)
        : null;
    return { kind: "lock", direction, initialColorIndex };
  }

  if (directionLocked === "vertical") {
    const delta = (dy / CARD_HEIGHT) * 100;
    const value = Math.round(Math.max(1, Math.min(100, startBrightness + delta)));
    return { kind: "brightness", value };
  }

  if (directionLocked === "left" && dots.length > 0 && dots[0]) {
    return { kind: "color", index: findClosestDot(clientX, dots) };
  }

  return { kind: "ignore" };
}
