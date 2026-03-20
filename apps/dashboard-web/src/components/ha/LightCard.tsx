import { useEntity } from "@hakit/core";
import { mdiLightbulb } from "@mdi/js";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { haIconToMdiPath } from "@/lib/ha/icons";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useOptimisticAction } from "@/hooks/useOptimisticAction";
import { InlineError } from "@/components/common/InlineError";
import type { CSSProperties, ChangeEvent } from "react";
import { useCallback, useRef } from "react";

interface LightCardProps {
  entityId: `light.${string}`;
}

function getRgbStyle(
  rgbColor: number[] | undefined
): CSSProperties | undefined {
  if (!rgbColor || rgbColor.length < 3) return undefined;
  const [r, g, b] = rgbColor;
  return {
    "--light-r": String(r),
    "--light-g": String(g),
    "--light-b": String(b),
  } as CSSProperties;
}

export function LightCard({ entityId }: LightCardProps) {
  const entity = useEntity(entityId, { returnNullIfNotFound: true });
  const { t } = useTranslation();
  const {
    optimisticValue: optimisticOn,
    execute,
    error,
    clearError,
  } = useOptimisticAction<boolean>();

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isUnavailable =
    !entity ||
    entity.state === "unavailable" ||
    entity.state === "unknown";

  const realOn = entity?.state === "on";
  const isOn = optimisticOn ?? realOn;
  const brightness = entity?.attributes.brightness ?? 0;
  const rgbColor = entity?.attributes.rgb_color as number[] | undefined;
  const friendlyName =
    entity?.attributes.friendly_name ?? entityId.split(".")[1] ?? entityId;
  const iconPath =
    haIconToMdiPath(entity?.attributes.icon ?? "") ?? mdiLightbulb;

  const supportedColorModes = (entity?.attributes.supported_color_modes ??
    []) as string[];
  const supportsColorTemp = supportedColorModes.includes("color_temp");
  const minMireds = (entity?.attributes.min_mireds as number) ?? 153;
  const maxMireds = (entity?.attributes.max_mireds as number) ?? 500;
  const colorTemp = (entity?.attributes.color_temp as number) ?? minMireds;

  const handleClick = useCallback(() => {
    if (isUnavailable || !entity) return;
    execute(!realOn, async () => {
      await entity.service.toggle();
    });
  }, [isUnavailable, entity, realOn, execute]);

  const handleBrightness = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (isUnavailable || !entity || !isOn) return;
      const value = Number(e.target.value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        entity.service
          .turnOn({ serviceData: { brightness: value } })
          .catch((err: unknown) => {
            console.error("Failed to set brightness:", entityId, err);
          });
      }, 200);
    },
    [isUnavailable, entity, isOn, entityId]
  );

  const handleColorTemp = useCallback(
    (e: ChangeEvent<HTMLInputElement>) => {
      if (isUnavailable || !entity || !isOn) return;
      const value = Number(e.target.value);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        entity.service
          .turnOn({ serviceData: { color_temp: value } })
          .catch((err: unknown) => {
            console.error("Failed to set color temp:", entityId, err);
          });
      }, 200);
    },
    [isUnavailable, entity, isOn, entityId]
  );

  const rgbStyle = isOn ? getRgbStyle(rgbColor) : undefined;
  const hasRgb = rgbStyle !== undefined;

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
      style={rgbStyle}
      className={cn(
        "cursor-pointer transition-colors duration-300 select-none",
        isOn && !hasRgb && "bg-amber-400/5 border-amber-900/50",
        isOn && hasRgb && "border-amber-900/50",
        isUnavailable && "opacity-50 pointer-events-none"
      )}
    >
      {/* Dynamic RGB tint overlay via CSS custom properties */}
      {isOn && hasRgb && (
        <div
          className="absolute inset-0 rounded-[inherit] pointer-events-none opacity-10"
          style={{
            backgroundColor: `rgb(var(--light-r), var(--light-g), var(--light-b))`,
          }}
        />
      )}

      <CardContent className="relative p-3 space-y-2">
        {/* Header: color dot + icon + name + brightness % */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isOn && rgbColor && rgbColor.length >= 3 && (
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{
                  backgroundColor: `rgb(${rgbColor[0]}, ${rgbColor[1]}, ${rgbColor[2]})`,
                }}
              />
            )}
            <Icon
              path={iconPath}
              size={0.9}
              className={isOn ? "text-amber-400" : "text-slate-400"}
            />
            <span
              className="text-sm font-medium text-slate-200 truncate"
              title={friendlyName}
            >
              {friendlyName}
            </span>
          </div>
          {isOn && (
            <span className="text-xs text-slate-400 shrink-0">
              {Math.round((brightness / 255) * 100)}%
            </span>
          )}
        </div>

        {/* Sliders — only when on. Stop propagation so clicks don't toggle. */}
        {isOn && !isUnavailable && (
          <div
            className="space-y-1.5"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => e.stopPropagation()}
          >
            <Slider
              min={1}
              max={255}
              step={1}
              value={brightness}
              onChange={handleBrightness}
              aria-label={t("lights.brightness")}
            />
            {supportsColorTemp && (
              <Slider
                min={minMireds}
                max={maxMireds}
                step={1}
                value={colorTemp}
                onChange={handleColorTemp}
                className="accent-sky-400"
                aria-label={t("lights.colorTemp")}
              />
            )}
          </div>
        )}

        {isUnavailable && (
          <p className="text-xs text-slate-500">{t("entity.unavailable")}</p>
        )}

        <InlineError message={error} onDismiss={clearError} />
      </CardContent>
    </Card>
  );
}
