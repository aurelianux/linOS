import { useEntity, useHass } from "@hakit/core";
import { mdiThermometer } from "@mdi/js";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { haIconToMdiPath } from "@/lib/ha/icons";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useCallback, useEffect, useRef, useState } from "react";

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

const TEMP_PRESETS = [8, 18, 21, 23] as const;
const PENDING_TIMEOUT_MS = 15_000;

export function ClimateCard({ entityId }: ClimateCardProps) {
  const entity = useEntity(entityId, { returnNullIfNotFound: true });
  const { helpers } = useHass();
  const { t } = useTranslation();

  const [pendingTemp, setPendingTemp] = useState<number | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const colorClass = HVAC_COLORS[hvacAction] ?? "text-slate-400";
  const isHeating = hvacAction === "heating";

  // Clear pending when HA confirms the target temperature
  useEffect(() => {
    if (pendingTemp !== null && targetTemp === pendingTemp) {
      setPendingTemp(null);
      if (pendingTimer.current) {
        clearTimeout(pendingTimer.current);
        pendingTimer.current = null;
      }
    }
  }, [targetTemp, pendingTemp]);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
    };
  }, []);

  const setTemp = useCallback(
    (temp: number) => {
      if (isUnavailable) return;

      setPendingTemp(temp);
      // Auto-clear pending after timeout in case HA never confirms
      if (pendingTimer.current) clearTimeout(pendingTimer.current);
      pendingTimer.current = setTimeout(() => {
        setPendingTemp(null);
        pendingTimer.current = null;
      }, PENDING_TIMEOUT_MS);

      try {
        helpers.callService({
          domain: "climate",
          service: "set_temperature",
          serviceData: { temperature: temp },
          target: { entity_id: entityId },
        });
      } catch (err: unknown) {
        console.error("Failed to set temperature:", entityId, err);
        setPendingTemp(null);
      }
    },
    [isUnavailable, entityId, helpers]
  );

  const displayTarget = pendingTemp ?? targetTemp;
  const isPending = pendingTemp !== null && pendingTemp !== targetTemp;

  return (
    <Card
      style={{ height: 140 }}
      className={cn(
        "select-none transition-colors duration-300",
        isHeating && "border-amber-900/30",
        hvacAction === "cooling" && "border-sky-900/30",
        isUnavailable && "opacity-50"
      )}
    >
      {/* Subtle heating/cooling glow */}
      {isHeating && (
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-amber-500/10 to-transparent rounded-b-lg transition-opacity duration-500" />
      )}
      {hvacAction === "cooling" && (
        <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-sky-500/10 to-transparent rounded-b-lg transition-opacity duration-500" />
      )}

      <div className="relative z-10 h-full flex flex-col justify-between p-3">
        {/* Header: icon + name */}
        <div className="flex items-center gap-2">
          <Icon
            path={iconPath}
            size={0.8}
            className={cn("shrink-0 transition-colors duration-300", colorClass)}
          />
          <span
            className="text-sm font-medium text-slate-200 truncate"
            title={friendlyName}
          >
            {friendlyName}
          </span>
        </div>

        {/* Center: current temperature + target indicator */}
        <div className="flex items-center justify-center gap-3">
          {currentTemp !== undefined ? (
            <span className={cn("text-3xl font-semibold tabular-nums transition-colors duration-300", colorClass)}>
              {currentTemp}
              <span className="text-lg font-normal text-slate-400">°</span>
            </span>
          ) : (
            <span className="text-xl text-slate-500">–</span>
          )}
          {displayTarget !== undefined && (
            <span className={cn(
              "text-sm tabular-nums transition-all duration-300",
              isPending ? "text-amber-400 animate-pulse" : "text-slate-500"
            )}>
              → {displayTarget}°
            </span>
          )}
        </div>

        {/* Footer: temperature presets */}
        <div className="flex items-center justify-between gap-1">
          {!isUnavailable ? (
            TEMP_PRESETS.map((temp) => {
              const isActive = displayTarget === temp;
              return (
                <button
                  key={temp}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTemp(temp);
                  }}
                  className={cn(
                    "flex-1 py-1 rounded-md text-xs font-medium tabular-nums",
                    "transition-all duration-200",
                    isActive
                      ? "bg-amber-400 text-slate-950 shadow-sm"
                      : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
                  )}
                >
                  {temp}°
                </button>
              );
            })
          ) : (
            <span className="text-xs text-slate-500 w-full text-center">
              {t("entity.unavailable")}
            </span>
          )}
        </div>
      </div>
    </Card>
  );
}
