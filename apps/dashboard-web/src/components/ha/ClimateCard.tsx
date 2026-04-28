import { useEntity, useHass } from "@hakit/core";
import { mdiThermometer } from "@mdi/js";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { haIconToMdiPath } from "@/lib/ha/icons";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useCallback, useEffect, useRef, useState } from "react";
import { HVAC_COLORS, TEMP_PRESETS, PENDING_TIMEOUT_MS, TempPresets } from "./ClimateCard.helpers";

interface ClimateCardProps {
  entityId: `climate.${string}`;
}

export function ClimateCard({ entityId }: ClimateCardProps) {
  const entity = useEntity(entityId, { returnNullIfNotFound: true });
  const { helpers } = useHass();
  const { t } = useTranslation();

  const [pendingTemp, setPendingTemp] = useState<number | null>(null);
  const pendingTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isUnavailable = !entity || entity.state === "unavailable" || entity.state === "unknown";
  const friendlyName = entity?.attributes.friendly_name ?? entityId.split(".")[1] ?? entityId;
  const iconPath = haIconToMdiPath(entity?.attributes.icon ?? "") ?? mdiThermometer;

  const currentTemp = entity?.attributes.current_temperature as number | undefined;
  const targetTemp = entity?.attributes.temperature as number | undefined;
  const hvacAction = (entity?.attributes.hvac_action as string) ?? entity?.state ?? "off";
  const colorClass = HVAC_COLORS[hvacAction] ?? "text-slate-400";
  const isHeating = hvacAction === "heating";
  const hasPendingConfirmation = pendingTemp !== null && targetTemp === pendingTemp;

  useEffect(() => {
    if (hasPendingConfirmation && pendingTimer.current) {
      clearTimeout(pendingTimer.current);
      pendingTimer.current = null;
    }
    return () => { if (pendingTimer.current) clearTimeout(pendingTimer.current); };
  }, [hasPendingConfirmation]);

  const setTemp = useCallback((temp: number) => {
    if (isUnavailable) return;
    setPendingTemp(temp);
    if (pendingTimer.current) clearTimeout(pendingTimer.current);
    pendingTimer.current = setTimeout(() => { setPendingTemp(null); pendingTimer.current = null; }, PENDING_TIMEOUT_MS);
    try {
      helpers.callService({ domain: "climate", service: "set_temperature", serviceData: { temperature: temp }, target: { entity_id: entityId } });
    } catch (err: unknown) {
      console.error("Failed to set temperature:", entityId, err);
      setPendingTemp(null);
    }
  }, [isUnavailable, entityId, helpers]);

  const displayTarget = hasPendingConfirmation ? targetTemp : pendingTemp ?? targetTemp;
  const isPending = pendingTemp !== null && !hasPendingConfirmation;

  return (
    <Card style={{ height: 140 }} className={cn("select-none transition-colors duration-300", isHeating && "border-amber-900/30", hvacAction === "cooling" && "border-sky-900/30", isUnavailable && "opacity-50")}>
      {isHeating && <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-amber-500/10 to-transparent rounded-b-lg transition-opacity duration-500" />}
      {hvacAction === "cooling" && <div className="absolute inset-x-0 bottom-0 h-1/3 bg-gradient-to-t from-sky-500/10 to-transparent rounded-b-lg transition-opacity duration-500" />}

      <div className="relative z-10 h-full flex flex-col justify-between p-3">
        <div className="flex items-center gap-2">
          <Icon path={iconPath} size={0.8} className={cn("shrink-0 transition-colors duration-300", colorClass)} />
          <span className="text-sm font-medium text-slate-200 truncate" title={friendlyName}>{friendlyName}</span>
        </div>

        <div className="flex items-center justify-center gap-3">
          {currentTemp !== undefined ? (
            <span className={cn("text-3xl font-semibold tabular-nums transition-colors duration-300", colorClass)}>
              {currentTemp}<span className="text-lg font-normal text-slate-400">°</span>
            </span>
          ) : (
            <span className="text-xl text-slate-500">–</span>
          )}
          {displayTarget !== undefined && (
            <span className={cn("text-sm tabular-nums transition-all duration-300", isPending ? "text-amber-400 animate-pulse" : "text-slate-500")}>
              → {displayTarget}°
            </span>
          )}
        </div>

        <div className="flex items-center justify-between gap-1">
          <TempPresets presets={TEMP_PRESETS} activeTemp={displayTarget} onSelect={setTemp} isUnavailable={isUnavailable} unavailableLabel={t("entity.unavailable")} />
        </div>
      </div>
    </Card>
  );
}
