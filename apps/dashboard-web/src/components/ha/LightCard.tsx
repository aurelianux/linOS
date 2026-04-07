import { useEntity } from "@hakit/core";
import { mdiArrowUp, mdiArrowDown, mdiPalette, mdiPower } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useLightGesture } from "@/hooks/useLightGesture";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

interface LightCardProps {
  entityId: `light.${string}`;
}

const CARD_HEIGHT = 140;
const COLOR_DOT_SIZE = 32;
const COLOR_DOT_GAP = 12;

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
  const cardRef = useRef<HTMLDivElement>(null);

  const presets = useMemo(
    () => dashConfig?.lightColorPresets ?? [],
    [dashConfig?.lightColorPresets]
  );

  const isUnavailable =
    !entity ||
    entity.state === "unavailable" ||
    entity.state === "unknown";

  const isOn = entity?.state === "on";
  const brightness = entity?.attributes.brightness ?? 0;
  const rgbColor = entity?.attributes.rgb_color as number[] | undefined;
  const friendlyName =
    entity?.attributes.friendly_name ?? entityId.split(".")[1] ?? entityId;

  // -- Optimistic brightness ------------------------------------------------

  const [optimisticBrightness, setOptimisticBrightness] = useState<number | null>(null);
  const optimisticTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasConfirmedOptimisticBrightness =
    optimisticBrightness !== null &&
    brightnessToPercent(brightness) === optimisticBrightness;

  // Stop the optimistic timeout once HA confirms brightness.
  useEffect(() => {
    if (!hasConfirmedOptimisticBrightness) return;
    if (optimisticTimer.current) {
      clearTimeout(optimisticTimer.current);
      optimisticTimer.current = null;
    }
  }, [hasConfirmedOptimisticBrightness]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (optimisticTimer.current) clearTimeout(optimisticTimer.current);
    };
  }, []);

  // -- Service calls --------------------------------------------------------

  const commitBrightness = useCallback(
    (percent: number) => {
      if (!entity || isUnavailable) return;
      const clamped = Math.max(1, Math.min(100, percent));
      setOptimisticBrightness(clamped);
      // Auto-clear after 5s if HA never confirms
      if (optimisticTimer.current) clearTimeout(optimisticTimer.current);
      optimisticTimer.current = setTimeout(() => {
        setOptimisticBrightness(null);
        optimisticTimer.current = null;
      }, 5000);
      const value = percentToBrightness(clamped);
      entity.service
        .turnOn({ serviceData: { brightness: value } })
        .catch((err: unknown) => {
          console.error("Failed to set brightness:", entityId, err);
          setOptimisticBrightness(null);
        });
    },
    [entity, isUnavailable, entityId]
  );

  const applyColorPreset = useCallback(
    (index: number) => {
      if (!entity || isUnavailable) return;
      const preset = presets[index];
      if (!preset) return;
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
    [entity, isUnavailable, entityId, presets]
  );

  const turnOff = useCallback(async () => {
    if (!entity || isUnavailable) return;
    try {
      await entity.service.turnOff();
    } catch (err: unknown) {
      console.error("Failed to turn off:", entityId, err);
    }
  }, [entity, isUnavailable, entityId]);

  // -- Gesture hook ---------------------------------------------------------

  const {
    showHints,
    direction,
    dragBrightness,
    colorIndex,
    dotRefs,
    handlers,
  } = useLightGesture({
    cardRef,
    isOn: isOn ?? false,
    brightness,
    isUnavailable,
    presetCount: presets.length,
    onBrightnessCommit: commitBrightness,
    onColorSelect: applyColorPreset,
    onTurnOff: turnOff,
  });

  // -- Derived values -------------------------------------------------------

  const actualBrightness = brightnessToPercent(brightness);
  const effectiveOptimisticBrightness = hasConfirmedOptimisticBrightness
    ? null
    : optimisticBrightness;
  const displayBrightness =
    dragBrightness !== null
      ? dragBrightness
      : effectiveOptimisticBrightness ?? actualBrightness;
  const fillPercent =
    dragBrightness !== null
      ? displayBrightness
      : effectiveOptimisticBrightness ?? (isOn ? actualBrightness : 0);
  const lightColor = getLightCss(rgbColor, isOn ?? false);

  const showBrightness = direction === "vertical";
  const showColorPicker = direction === "left";
  const showPowerOff = direction === "right";

  return (
    <Card
      ref={cardRef}
      {...handlers}
      style={{ height: CARD_HEIGHT, touchAction: "none" }}
      className={cn(
        "cursor-pointer select-none",
        // Extra horizontal margin on mobile so users can scroll the page
        // without accidentally triggering the brightness gesture
        "mx-2 md:mx-0",
        isOn ? "border-amber-900/40" : "border-slate-700",
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

      {/* Directional hint arrows — appear after 150ms press hold */}
      {showHints && (
        <div className="absolute inset-0 z-20 pointer-events-none">
          <div className="relative w-full h-full">
            <div className="absolute top-2 left-1/2 -translate-x-1/2">
              <Icon path={mdiArrowUp} size={0.9} className="text-slate-400 animate-pulse" />
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
              <Icon path={mdiArrowDown} size={0.9} className="text-slate-400 animate-pulse" />
            </div>
            {presets.length > 0 && (
              <div className="absolute left-2 top-1/2 -translate-y-1/2">
                <Icon path={mdiPalette} size={0.9} className="text-slate-400 animate-pulse" />
              </div>
            )}
            {isOn && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <Icon path={mdiPower} size={0.9} className="text-slate-400 animate-pulse" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Color picker overlay — mounts only when direction is "left" */}
      {showColorPicker && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/85 rounded-lg">
          <div className="flex items-center" style={{ gap: COLOR_DOT_GAP }}>
            {presets.map((preset, idx) => (
              <div
                key={preset.id}
                ref={(el) => {
                  dotRefs.current[idx] = el;
                }}
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
      )}

      {/* Power off overlay — mounts only when direction is "right" */}
      {showPowerOff && (
        <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/85 rounded-lg">
          <div className="flex flex-col items-center gap-1">
            <Icon path={mdiPower} size={1.5} className="text-red-400" />
            <span className="text-xs text-red-400 font-medium">{t("lights.off")}</span>
          </div>
        </div>
      )}

      {/* Brightness drag overlay — large centered percentage */}
      {showBrightness && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
          <span className="text-3xl font-bold text-slate-100 tabular-nums drop-shadow-lg">
            {displayBrightness}%
          </span>
        </div>
      )}

      {/* Content — name + brightness label */}
      <div
        className={cn(
          "relative z-10 h-full flex flex-col justify-end p-2.5",
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
