import { useEntity, useHass } from "@hakit/core";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import type { LightColorPreset } from "@/lib/api/types";

interface LightCardProps {
  entityId: `light.${string}`;
}

const CARD_HEIGHT = 140;
const LONG_PRESS_MS = 400;
const DRAG_THRESHOLD = 5;

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

export function LightCard({ entityId }: LightCardProps) {
  const entity = useEntity(entityId, { returnNullIfNotFound: true });
  const { helpers } = useHass();
  const { t } = useTranslation();
  const { data: dashConfig } = useDashboardConfig();

  const presets = dashConfig?.lightColorPresets ?? [];

  // Gesture state
  const [isDragging, setIsDragging] = useState(false);
  const [dragBrightness, setDragBrightness] = useState<number | null>(null);
  const [showColorMode, setShowColorMode] = useState(false);
  const [colorIndex, setColorIndex] = useState<number | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const startY = useRef(0);
  const startX = useRef(0);
  const startBrightness = useRef(0);
  const gestureStarted = useRef(false);
  const isLongPress = useRef(false);

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
  const fillPercent = isOn ? displayBrightness : 0;
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
      if (!entity || isUnavailable || !helpers?.callService) return;
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
    [entity, isUnavailable, entityId, helpers]
  );

  const handleToggle = useCallback(async () => {
    if (!entity || isUnavailable) return;
    try {
      await entity.service.toggle();
    } catch (err: unknown) {
      console.error("Failed to toggle:", entityId, err);
    }
  }, [entity, isUnavailable, entityId]);

  // -- Pointer events (unified touch + mouse) --------------------------------

  const onPointerDown = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (isUnavailable) return;
      e.preventDefault();
      const el = cardRef.current;
      if (el) el.setPointerCapture(e.pointerId);

      startY.current = e.clientY;
      startX.current = e.clientX;
      startBrightness.current = brightnessToPercent(brightness);
      gestureStarted.current = false;
      isLongPress.current = false;

      // Start long press timer for color mode
      longPressTimer.current = setTimeout(() => {
        if (!gestureStarted.current && presets.length > 0) {
          isLongPress.current = true;
          setShowColorMode(true);
          setColorIndex(null);
        }
      }, LONG_PRESS_MS);
    },
    [isUnavailable, brightness, presets.length]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (isUnavailable) return;

      if (showColorMode || isLongPress.current) {
        // Horizontal color mode: map X position to preset index
        const el = cardRef.current;
        if (!el) return;
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const ratio = Math.max(0, Math.min(1, x / rect.width));
        const idx = Math.min(
          presets.length - 1,
          Math.floor(ratio * presets.length)
        );
        setColorIndex(idx);
        return;
      }

      const dy = startY.current - e.clientY;
      const dx = e.clientX - startX.current;

      if (!gestureStarted.current) {
        const dist = Math.sqrt(dy * dy + dx * dx);
        if (dist < DRAG_THRESHOLD) return;
        // Cancel long press if movement detected
        if (longPressTimer.current) {
          clearTimeout(longPressTimer.current);
          longPressTimer.current = null;
        }
        gestureStarted.current = true;
        setIsDragging(true);
      }

      // Vertical drag: map to brightness
      if (!isOn) return;
      const sensitivity = CARD_HEIGHT;
      const delta = (dy / sensitivity) * 100;
      const newPercent = Math.max(1, Math.min(100, startBrightness.current + delta));
      setDragBrightness(Math.round(newPercent));
    },
    [isUnavailable, showColorMode, isOn, presets.length]
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = cardRef.current;
      if (el) el.releasePointerCapture(e.pointerId);

      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }

      if (showColorMode && colorIndex !== null && presets[colorIndex]) {
        applyPreset(presets[colorIndex]);
      } else if (isDragging && dragBrightness !== null) {
        setBrightness(dragBrightness);
      } else if (!gestureStarted.current && !isLongPress.current) {
        // Simple tap → toggle
        handleToggle();
      }

      setIsDragging(false);
      setDragBrightness(null);
      setShowColorMode(false);
      setColorIndex(null);
      gestureStarted.current = false;
      isLongPress.current = false;
    },
    [
      showColorMode,
      colorIndex,
      presets,
      isDragging,
      dragBrightness,
      applyPreset,
      setBrightness,
      handleToggle,
    ]
  );

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = cardRef.current;
      if (el) el.releasePointerCapture(e.pointerId);
      if (longPressTimer.current) {
        clearTimeout(longPressTimer.current);
        longPressTimer.current = null;
      }
      setIsDragging(false);
      setDragBrightness(null);
      setShowColorMode(false);
      setColorIndex(null);
      gestureStarted.current = false;
      isLongPress.current = false;
    },
    []
  );

  return (
    <Card
      ref={cardRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
      style={{ height: CARD_HEIGHT, touchAction: "none" }}
      className={cn(
        "cursor-pointer select-none border-slate-700",
        isUnavailable && "opacity-50 pointer-events-none",
        !isOn && "bg-slate-900"
      )}
    >
      {/* Color fill — height represents brightness */}
      <div
        className="absolute inset-x-0 bottom-0 transition-all duration-150 rounded-b-lg"
        style={{
          height: `${fillPercent}%`,
          backgroundColor: lightColor ?? "rgb(251 191 36 / 0.15)",
          opacity: lightColor ? 0.25 : 1,
        }}
      />

      {/* Color mode overlay */}
      {showColorMode && presets.length > 0 && (
        <div className="absolute inset-0 z-20 flex items-center justify-center gap-2 bg-slate-950/80 rounded-lg">
          {presets.map((preset, idx) => (
            <div
              key={preset.id}
              className={cn(
                "w-8 h-8 rounded-full border-2 transition-transform duration-100",
                colorIndex === idx
                  ? "scale-125 border-slate-100"
                  : "border-slate-600"
              )}
              style={{ backgroundColor: preset.displayColor }}
            />
          ))}
        </div>
      )}

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-end p-3">
        <div className="flex items-end justify-between">
          <span
            className={cn(
              "text-sm font-medium truncate",
              isOn ? "text-slate-100" : "text-slate-400"
            )}
            title={friendlyName}
          >
            {friendlyName}
          </span>
          {isOn && (
            <span className="text-xs text-slate-300 tabular-nums ml-2 shrink-0">
              {displayBrightness}%
            </span>
          )}
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
