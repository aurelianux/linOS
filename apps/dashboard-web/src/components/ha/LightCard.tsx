import { useEntity, useHass } from "@hakit/core";
import { mdiLightbulb } from "@mdi/js";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";
import { haIconToMdiPath } from "@/lib/ha/icons";
import { cn } from "@/lib/utils";
import { Icon } from "@/components/ui/icon";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { InlineError } from "@/components/common/InlineError";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import type { ChangeEvent } from "react";
import { useCallback, useRef, useState } from "react";

interface LightCardProps {
  entityId: `light.${string}`;
}

export function LightCard({ entityId }: LightCardProps) {
  const entity = useEntity(entityId, { returnNullIfNotFound: true });
  const { callService } = useHass();
  const { t } = useTranslation();
  const { data: dashConfig } = useDashboardConfig();
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const presets = dashConfig?.lightColorPresets ?? [];

  const isUnavailable =
    !entity ||
    entity.state === "unavailable" ||
    entity.state === "unknown";

  const isOn = entity?.state === "on";
  const brightness = entity?.attributes.brightness ?? 0;
  const rgbColor = entity?.attributes.rgb_color as number[] | undefined;
  const friendlyName =
    entity?.attributes.friendly_name ?? entityId.split(".")[1] ?? entityId;
  const iconPath =
    haIconToMdiPath(entity?.attributes.icon ?? "") ?? mdiLightbulb;

  const handleToggle = useCallback(async () => {
    if (isUnavailable || !entity) return;
    try {
      await entity.service.toggle();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : t("lights.toggleError");
      setError(msg);
      setTimeout(() => setError(null), 3000);
    }
  }, [isUnavailable, entity, t]);

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

  const handlePreset = useCallback(
    async (presetId: string) => {
      if (isUnavailable || !entity) return;
      try {
        await callService({
          domain: "script",
          service: "apply_light_color_preset",
          serviceData: {
            target_light: entityId,
            preset: presetId,
          },
        });
      } catch (err: unknown) {
        console.error("Failed to apply preset:", entityId, presetId, err);
      }
    },
    [isUnavailable, entity, entityId, callService]
  );

  const clearError = useCallback(() => setError(null), []);

  return (
    <Card
      role="button"
      tabIndex={0}
      onClick={handleToggle}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleToggle();
        }
      }}
      className={cn(
        "cursor-pointer transition-colors duration-300 select-none",
        isOn && "bg-amber-400/5 border-amber-900/50",
        isUnavailable && "opacity-50 pointer-events-none"
      )}
    >
      <CardContent className="p-2.5 space-y-1.5">
        {/* Header: color dot + icon + name + brightness % */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            {isOn && rgbColor && rgbColor.length >= 3 && (
              <span
                className="w-2 h-2 rounded-full shrink-0"
                style={{
                  backgroundColor: `rgb(${rgbColor[0]}, ${rgbColor[1]}, ${rgbColor[2]})`,
                }}
              />
            )}
            <Icon
              path={iconPath}
              size={0.8}
              className={cn(
                "shrink-0",
                isOn ? "text-amber-400" : "text-slate-400"
              )}
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

        {/* Controls — only when on. Stop propagation so clicks don't toggle. */}
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

            {/* Color presets */}
            {presets.length > 0 && (
              <div className="flex items-center gap-1.5">
                {presets.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    title={preset.label}
                    onClick={() => handlePreset(preset.id)}
                    className="w-5 h-5 rounded-full border border-slate-600 hover:border-slate-400 transition-colors shrink-0"
                    style={{ backgroundColor: preset.color }}
                  />
                ))}
              </div>
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
