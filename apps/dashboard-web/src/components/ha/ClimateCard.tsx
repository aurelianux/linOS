import { useEntity } from "@hakit/core";
import { mdiThermometer, mdiMinus, mdiPlus } from "@mdi/js";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { haIconToMdiPath } from "@/lib/ha/icons";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useCallback } from "react";

interface ClimateCardProps {
  entityId: `climate.${string}`;
}

const HVAC_COLORS: Record<string, string> = {
  heating: "text-amber-400",
  cooling: "text-sky-400",
  heat_cool: "text-amber-400",
  auto: "text-emerald-400",
  off: "text-slate-500",
  idle: "text-slate-400",
};

export function ClimateCard({ entityId }: ClimateCardProps) {
  const entity = useEntity(entityId, { returnNullIfNotFound: true });
  const { t } = useTranslation();

  const isUnavailable =
    !entity ||
    entity.state === "unavailable" ||
    entity.state === "unknown";

  const friendlyName =
    entity?.attributes.friendly_name ?? entityId.split(".")[1] ?? entityId;
  const iconPath =
    haIconToMdiPath(entity?.attributes.icon ?? "") ?? mdiThermometer;

  const currentTemp = entity?.attributes.current_temperature as
    | number
    | undefined;
  const targetTemp = entity?.attributes.temperature as number | undefined;
  const hvacAction = (entity?.attributes.hvac_action as string) ?? entity?.state ?? "off";
  const minTemp = (entity?.attributes.min_temp as number) ?? 5;
  const maxTemp = (entity?.attributes.max_temp as number) ?? 35;
  const tempStep = (entity?.attributes.target_temp_step as number) ?? 0.5;

  const colorClass = HVAC_COLORS[hvacAction] ?? "text-slate-400";
  const isHeating = hvacAction === "heating";

  const adjustTemp = useCallback(
    (delta: number) => {
      if (!entity || isUnavailable || targetTemp === undefined) return;
      const newTemp = Math.max(minTemp, Math.min(maxTemp, targetTemp + delta));
      entity.service
        .setTemperature({ serviceData: { temperature: newTemp } })
        .catch((err: unknown) => {
          console.error("Failed to set temperature:", entityId, err);
        });
    },
    [entity, isUnavailable, targetTemp, minTemp, maxTemp, entityId]
  );

  return (
    <Card
      style={{ height: 140 }}
      className={cn(
        "select-none",
        isUnavailable && "opacity-50"
      )}
    >
      {/* Subtle heating/cooling glow */}
      {isHeating && (
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-amber-500/10 to-transparent rounded-b-lg" />
      )}
      {hvacAction === "cooling" && (
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-sky-500/10 to-transparent rounded-b-lg" />
      )}

      <div className="relative z-10 h-full flex flex-col justify-between p-3">
        {/* Header: icon + name */}
        <div className="flex items-center gap-2">
          <Icon
            path={iconPath}
            size={0.8}
            className={cn("shrink-0", colorClass)}
          />
          <span
            className="text-sm font-medium text-slate-200 truncate"
            title={friendlyName}
          >
            {friendlyName}
          </span>
        </div>

        {/* Center: current temperature large */}
        <div className="flex items-center justify-center">
          {currentTemp !== undefined ? (
            <span className={cn("text-3xl font-semibold tabular-nums", colorClass)}>
              {currentTemp}
              <span className="text-lg font-normal text-slate-400">°</span>
            </span>
          ) : (
            <span className="text-xl text-slate-500">–</span>
          )}
        </div>

        {/* Footer: target temp controls */}
        <div className="flex items-center justify-between">
          {targetTemp !== undefined && !isUnavailable ? (
            <>
              <button
                type="button"
                onClick={() => adjustTemp(-tempStep)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
                aria-label={t("lights.brightness")}
              >
                <Icon path={mdiMinus} size={0.6} className="text-slate-300" />
              </button>
              <span className="text-sm text-slate-400 tabular-nums">
                {t("climate.target")}: {targetTemp}°
              </span>
              <button
                type="button"
                onClick={() => adjustTemp(tempStep)}
                className="w-7 h-7 rounded-full bg-slate-800 hover:bg-slate-700 flex items-center justify-center transition-colors"
                aria-label={t("lights.brightness")}
              >
                <Icon path={mdiPlus} size={0.6} className="text-slate-300" />
              </button>
            </>
          ) : (
            <span className="text-xs text-slate-500 w-full text-center">
              {isUnavailable
                ? t("entity.unavailable")
                : entity?.state ?? "–"}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
