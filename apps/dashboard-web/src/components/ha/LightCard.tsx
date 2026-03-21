import { useEntity } from "@hakit/core";
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
  const { t } = useTranslation();
  const { data: dashConfig } = useDashboardConfig();

  const presets = dashConfig?.lightColorPresets ?? [];

  // Gesture state
  const [isDragging, setIsDragging] = useState(false);
  const [dragBrightness, setDragBrightness] = useState<number | null>(null);

  const cardRef = useRef<HTMLDivElement>(null);
  const startY = useRef(0);
  const startBrightness = useRef(0);
  const gestureStarted = useRef(false);

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
      // Ignore clicks on color preset buttons
      if ((e.target as HTMLElement).closest("[data-preset]")) return;

      e.preventDefault();
      const el = cardRef.current;
      if (el) el.setPointerCapture(e.pointerId);

      startY.current = e.clientY;
      startBrightness.current = brightnessToPercent(brightness);
      gestureStarted.current = false;
    },
    [isUnavailable, brightness]
  );

  const onPointerMove = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      if (isUnavailable) return;

      const dy = startY.current - e.clientY;

      if (!gestureStarted.current) {
        if (Math.abs(dy) < DRAG_THRESHOLD) return;
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
    [isUnavailable, isOn]
  );

  const onPointerUp = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = cardRef.current;
      if (el) el.releasePointerCapture(e.pointerId);

      if (isDragging && dragBrightness !== null) {
        setBrightness(dragBrightness);
      } else if (!gestureStarted.current) {
        // Simple tap → toggle
        handleToggle();
      }

      setIsDragging(false);
      setDragBrightness(null);
      gestureStarted.current = false;
    },
    [isDragging, dragBrightness, setBrightness, handleToggle]
  );

  const onPointerCancel = useCallback(
    (e: ReactPointerEvent<HTMLDivElement>) => {
      const el = cardRef.current;
      if (el) el.releasePointerCapture(e.pointerId);
      setIsDragging(false);
      setDragBrightness(null);
      gestureStarted.current = false;
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
        "cursor-pointer select-none transition-colors duration-300",
        isOn ? "border-amber-900/40" : "border-slate-700",
        isUnavailable && "opacity-50 pointer-events-none"
      )}
    >
      {/* Color fill — height represents brightness, smooth transition */}
      <div
        className={cn(
          "absolute inset-x-0 bottom-0 rounded-b-lg",
          isDragging ? "transition-none" : "transition-all duration-500 ease-out"
        )}
        style={{
          height: `${fillPercent}%`,
          backgroundColor: lightColor ?? "rgb(251 191 36 / 0.15)",
          opacity: lightColor ? 0.25 : 1,
        }}
      />

      {/* Content */}
      <div className="relative z-10 h-full flex flex-col justify-between p-2.5">
        {/* Top: brightness percentage when dragging */}
        <div className="flex items-start justify-between">
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
              isOn ? "text-slate-300 opacity-100" : "opacity-0"
            )}
          >
            {displayBrightness}%
          </span>
        </div>

        {/* Spacer */}
        <div />

        {/* Bottom: color presets — always visible when on */}
        {isOn && presets.length > 0 ? (
          <div className="flex items-center gap-1.5">
            {presets.map((preset) => (
              <button
                key={preset.id}
                type="button"
                data-preset={preset.id}
                onClick={(e) => {
                  e.stopPropagation();
                  applyPreset(preset);
                }}
                className="w-5 h-5 rounded-full border border-slate-600 hover:border-slate-400 hover:scale-125 active:scale-95 transition-all duration-150"
                style={{ backgroundColor: preset.displayColor }}
                title={t(`lights.preset.${preset.id}` as Parameters<typeof t>[0])}
              />
            ))}
          </div>
        ) : (
          <div className="h-5" />
        )}

        {isUnavailable && (
          <p className="text-xs text-slate-500 mt-0.5">
            {t("entity.unavailable")}
          </p>
        )}
      </div>
    </Card>
  );
}
