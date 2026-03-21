import { useEntity } from "@hakit/core";
import { mdiArrowUp, mdiArrowDown, mdiPalette, mdiPower } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useCallback, useRef, useState, useEffect } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { LightColorPreset } from "@/lib/api/types";

interface LightCardProps {
  entityId: `light.${string}`;
}

const CARD_HEIGHT = 140;
const DRAG_THRESHOLD = 8;
const DIRECTION_LOCK_THRESHOLD = 12;
const COLOR_DOT_SIZE = 32;
const COLOR_DOT_GAP = 12;

type GestureDirection = "none" | "vertical" | "left" | "right";

function brightnessToPercent(b: number): number {
  return Math.round((b / 255) * 100);
}

function percentToBrightness(p: number): number {
  return Math.round((p / 100) * 255);
}

function getLightCss(
  rgbColor: number[] | undefined,
  isOn: boolean
): string | undefined {
  if (!isOn || !rgbColor || rgbColor.length < 3) return undefined;
  return `rgb(${rgbColor[0]}, ${rgbColor[1]}, ${rgbColor[2]})`;
}

/** Map a clientX to the nearest dot index based on centered dot layout */
function clientXToDotIndex(
  clientX: number,
  cardRect: DOMRect,
  dotCount: number
): number {
  const totalDotsWidth =
    dotCount * COLOR_DOT_SIZE + (dotCount - 1) * COLOR_DOT_GAP;
  const offsetLeft = (cardRect.width - totalDotsWidth) / 2;
  const relativeX = clientX - cardRect.left - offsetLeft;

  // Find which dot center is closest
  let closestIdx = 0;
  let closestDist = Infinity;
  for (let i = 0; i < dotCount; i++) {
    const dotCenter = i * (COLOR_DOT_SIZE + COLOR_DOT_GAP) + COLOR_DOT_SIZE / 2;
    const dist = Math.abs(relativeX - dotCenter);
    if (dist < closestDist) {
      closestDist = dist;
      closestIdx = i;
    }
  }
  return closestIdx;
}

export function LightCard({ entityId }: LightCardProps) {
  const entity = useEntity(entityId, { returnNullIfNotFound: true });
  const { t } = useTranslation();
  const { data: dashConfig } = useDashboardConfig();

  const presets = dashConfig?.lightColorPresets ?? [];

  // Gesture state
  const [isPressed, setIsPressed] = useState(false);
  const [direction, setDirection] = useState<GestureDirection>("none");
  const [dragBrightness, setDragBrightness] = useState<number | null>(null);
  const [colorIndex, setColorIndex] = useState<number | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startX = useRef(0);
  const startBrightness = useRef(0);
  const directionLocked = useRef<GestureDirection>("none");
  const activePointerId = useRef<number | null>(null);

  const isUnavailable =
    !entity ||
    entity.state === "unavailable" ||
    entity.state === "unknown";

  const isOn = entity?.state === "on";
  const brightness = entity?.attributes.brightness ?? 0;
  const rgbColor = entity?.attributes.rgb_color as number[] | undefined;
  const friendlyName =
    entity?.attributes.friendly_name ?? entityId.split(".")[1] ?? entityId;

  const displayBrightness =
    dragBrightness !== null ? dragBrightness : brightnessToPercent(brightness);
  const fillPercent = isOn || dragBrightness !== null ? displayBrightness : 0;
  const lightColor = getLightCss(rgbColor, isOn);

  // -- Service calls --------------------------------------------------------

  const setBrightness = useCallback(
    (percent: number) => {
      if (!entity || isUnavailable) return;
      const value = percentToBrightness(Math.max(1, Math.min(100, percent)));
      entity.service
        .turnOn({ serviceData: { brightness: value } })
        .catch((err: unknown) => {
          console.error("Failed to set brightness:", entityId, err);
        });
    },
    [entity, isUnavailable, entityId]
  );

  const applyPreset = useCallback(
    (preset: LightColorPreset) => {
      if (!entity || isUnavailable) return;
      const serviceData: Record<string, unknown> = {};
      if (preset.colorTemp !== undefined) {
        serviceData.color_temp = preset.colorTemp;
      } else if (preset.hsColor !== undefined) {
        serviceData.hs_color = preset.hsColor;
      }
      entity.service
        .turnOn({ serviceData })
        .catch((err: unknown) => {
          console.error("Failed to apply preset:", entityId, preset.id, err);
        });
    },
    [entity, isUnavailable, entityId]
  );

  const turnOff = useCallback(async () => {
    if (!entity || isUnavailable) return;
    try {
      await entity.service.turnOff();
    } catch (err: unknown) {
      console.error("Failed to turn off:", entityId, err);
    }
  }, [entity, isUnavailable, entityId]);

  // -- Reset ----------------------------------------------------------------

  const resetGesture = useCallback(() => {
    setIsPressed(false);
    setDirection("none");
    setDragBrightness(null);
    setColorIndex(null);
    directionLocked.current = "none";
    activePointerId.current = null;
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") resetGesture();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [resetGesture]);

  // -- Pointer events --------------------------------------------------------

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
      setIsPressed(true);
      setDirection("none");
      setDragBrightness(null);
      setColorIndex(null);
    },
    [isUnavailable, brightness, isOn]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (isUnavailable || activePointerId.current === null) return;

      const dy = startY.current - e.clientY;
      const dx = e.clientX - startX.current;
      const absDy = Math.abs(dy);
      const absDx = Math.abs(dx);

      // Lock direction once threshold is crossed
      if (directionLocked.current === "none") {
        const dist = Math.sqrt(dy * dy + dx * dx);
        if (dist < DRAG_THRESHOLD) return;

        if (dist >= DIRECTION_LOCK_THRESHOLD) {
          if (absDy > absDx) {
            directionLocked.current = "vertical";
          } else if (dx < -DIRECTION_LOCK_THRESHOLD) {
            directionLocked.current = "left";
          } else if (dx > DIRECTION_LOCK_THRESHOLD && isOn) {
            directionLocked.current = "right";
          }
          setDirection(directionLocked.current);
        }
        return;
      }

      if (directionLocked.current === "vertical") {
        // Works whether light is on or off — dragging up from off turns it on
        const sensitivity = CARD_HEIGHT;
        const delta = (dy / sensitivity) * 100;
        const newPercent = Math.max(1, Math.min(100, startBrightness.current + delta));
        setDragBrightness(Math.round(newPercent));
      } else if (directionLocked.current === "left" && presets.length > 0) {
        const el = cardRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const idx = clientXToDotIndex(e.clientX, rect, presets.length);
        setColorIndex(idx);
      }
    },
    [isUnavailable, isOn, presets.length]
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = cardRef.current;
      if (el) el.releasePointerCapture(e.pointerId);

      const dir = directionLocked.current;

      if (dir === "vertical" && dragBrightness !== null) {
        setBrightness(dragBrightness);
      } else if (dir === "left" && colorIndex !== null && presets[colorIndex]) {
        applyPreset(presets[colorIndex]);
      } else if (dir === "right" && isOn) {
        turnOff();
      }
      // No action on simple tap (dir === "none") — no toggle

      resetGesture();
    },
    [dragBrightness, colorIndex, presets, isOn, setBrightness, applyPreset, turnOff, resetGesture]
  );

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = cardRef.current;
      if (el) el.releasePointerCapture(e.pointerId);
      resetGesture();
    },
    [resetGesture]
  );

  // -- Derived UI state -----------------------------------------------------

  const showHints = isPressed && direction === "none";
  const showBrightness = direction === "vertical";
  const showColorPicker = direction === "left";
  const showPowerOff = direction === "right";

  return (
    <Card
      ref={cardRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={{ height: CARD_HEIGHT, touchAction: "none" }}
      className={cn(
        "cursor-pointer select-none",
        isOn ? "border-amber-900/40" : "border-slate-700",
        isPressed && "border-slate-500",
        isUnavailable && "opacity-50 pointer-events-none"
      )}
    >
      {/* Color fill — height = brightness */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 rounded-b-lg",
          showBrightness ? "transition-none" : "transition-all duration-500 ease-out"
        )}
        style={{
          height: `${fillPercent}%`,
          backgroundColor: lightColor ?? "rgb(251 191 36 / 0.15)",
          opacity: lightColor ? 0.25 : 1,
        }}
      />

      {/* Directional hint arrows — appear on press */}
      <div
        className={cn(
          "absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-200 pointer-events-none",
          showHints ? "opacity-100" : "opacity-0"
        )}
      >
        <div className="relative w-full h-full">
          {/* Up: brightness up */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2">
            <Icon path={mdiArrowUp} size={0.6} className="text-slate-400 animate-pulse" />
          </div>
          {/* Down: brightness down */}
          <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
            <Icon path={mdiArrowDown} size={0.6} className="text-slate-400 animate-pulse" />
          </div>
          {/* Left: color */}
          {presets.length > 0 && (
            <div className="absolute left-2 top-1/2 -translate-y-1/2">
              <Icon path={mdiPalette} size={0.6} className="text-slate-400 animate-pulse" />
            </div>
          )}
          {/* Right: power off (only when on) */}
          {isOn && (
            <div className="absolute right-2 top-1/2 -translate-y-1/2">
              <Icon path={mdiPower} size={0.6} className="text-slate-400 animate-pulse" />
            </div>
          )}
        </div>
      </div>

      {/* Color picker overlay */}
      <div
        className={cn(
          "absolute inset-0 z-20 flex items-center justify-center bg-slate-950/85 rounded-lg transition-opacity duration-200",
          showColorPicker ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="flex items-center" style={{ gap: COLOR_DOT_GAP }}>
          {presets.map((preset, idx) => (
            <div
              key={preset.id}
              className={cn(
                "rounded-full border-2 transition-all duration-150",
                colorIndex === idx
                  ? "scale-150 border-slate-100 shadow-lg"
                  : "border-slate-600 scale-100"
              )}
              style={{
                width: COLOR_DOT_SIZE,
                height: COLOR_DOT_SIZE,
                backgroundColor: preset.displayColor,
              }}
            />
          ))}
        </div>
      </div>

      {/* Power off overlay */}
      <div
        className={cn(
          "absolute inset-0 z-20 flex items-center justify-center bg-slate-950/85 rounded-lg transition-opacity duration-200",
          showPowerOff ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
      >
        <div className="flex flex-col items-center gap-1">
          <Icon path={mdiPower} size={1.5} className="text-red-400" />
          <span className="text-xs text-red-400 font-medium">{t("lights.off")}</span>
        </div>
      </div>

      {/* Brightness drag overlay — large centered percentage */}
      <div
        className={cn(
          "absolute inset-0 z-20 flex items-center justify-center transition-opacity duration-200 pointer-events-none",
          showBrightness ? "opacity-100" : "opacity-0"
        )}
      >
        <span className="text-3xl font-bold text-slate-100 tabular-nums drop-shadow-lg">
          {displayBrightness}%
        </span>
      </div>

      {/* Content — name + brightness label */}
      <div
        className={cn(
          "relative z-10 h-full flex flex-col justify-end p-2.5 transition-opacity duration-200",
          (showColorPicker || showPowerOff) && "opacity-0"
        )}
      >
        <div className="flex items-end justify-between">
          <span
            className={cn(
              "text-sm font-medium truncate transition-colors duration-300",
              isOn ? "text-slate-100" : "text-slate-400"
            )}
            title={friendlyName}
          >
            {friendlyName}
          </span>
          <span
            className={cn(
              "text-xs tabular-nums ml-2 shrink-0 transition-opacity duration-200",
              isOn && !showBrightness ? "text-slate-300 opacity-100" : "opacity-0"
            )}
          >
            {brightnessToPercent(brightness)}%
          </span>
        </div>

        {isUnavailable && (
          <p className="text-xs text-slate-500 mt-0.5">
            {t("entity.unavailable")}
          </p>
        )}
      </div>
    </Card>
  );
}
