import { HeaderBadge } from "@/components/layout/HeaderBadge";
import { SystemMetricBadge } from "@/components/layout/SystemMetricBadge";
import { useMetricHistory } from "@/hooks/useMetricHistory";
import { useSystemVitals } from "@/hooks/useSystemVitals";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { cn } from "@/lib/utils";
import { useHass } from "@hakit/core";
import { mdiThermometer, mdiWaterPercent, mdiBatteryLow, mdiMotionSensor } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { MOTION_GRACE_PERIOD_S, formatElapsed, useElapsedSince } from "./Header.helpers";
import { useEntityValue, useBatteryLevel, getTemperatureColor, BATTERY_LOW_THRESHOLD } from "./RoomClimateBadge.helpers";

export function SystemBadge() {
  const { data } = useSystemVitals();
  const cpuHistory = useMetricHistory(data?.cpuLoadPercent ?? null);
  const ramHistory = useMetricHistory(data?.memoryUsedPercent ?? null);
  if (!data) return null;
  return (
    <HeaderBadge>
      <SystemMetricBadge label="CPU" percent={data.cpuLoadPercent} history={cpuHistory} />
      <span className="text-slate-600 mx-0.5">|</span>
      <SystemMetricBadge label="RAM" percent={data.memoryUsedPercent} history={ramHistory} />
    </HeaderBadge>
  );
}

export function ClimateBadge({ roomKey, icon, temperatureEntityId, humidityEntityId, batteryEntityId }: {
  roomKey: string; icon: string;
  temperatureEntityId: `sensor.${string}`;
  humidityEntityId: `sensor.${string}`;
  batteryEntityId?: `sensor.${string}`;
}) {
  const { t } = useTranslation();
  const temp = useEntityValue(temperatureEntityId);
  const humid = useEntityValue(humidityEntityId);
  const battery = useBatteryLevel(batteryEntityId);
  const isBatteryLow = battery !== null && battery < BATTERY_LOW_THRESHOLD;
  const roomLabel = t(`room.${roomKey}` as Parameters<typeof t>[0]);
  const tempColor = getTemperatureColor(temp.numericValue);

  return (
    <HeaderBadge title={isBatteryLow ? `${roomLabel}: ${t("header.climate.lowBattery")} (${battery}%)` : roomLabel} variant={isBatteryLow ? "alert" : "default"}>
      <Icon path={icon} size={0.55} className="text-slate-400" />
      <div className="flex items-center gap-0.5">
        <Icon path={mdiThermometer} size={0.45} className={tempColor} />
        <span className={cn("font-semibold tabular-nums", temp.isUnavailable ? "text-slate-500" : tempColor)}>
          {temp.value}{!temp.isUnavailable && <span className="text-slate-500 font-normal">{temp.unit}</span>}
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        <Icon path={mdiWaterPercent} size={0.45} className="text-sky-400" />
        <span className={cn("font-semibold tabular-nums", humid.isUnavailable ? "text-slate-500" : "text-slate-100")}>
          {humid.value}{!humid.isUnavailable && <span className="text-slate-500 font-normal">{humid.unit}</span>}
        </span>
      </div>
      {isBatteryLow && (
        <div className="flex items-center gap-0.5">
          <Icon path={mdiBatteryLow} size={0.45} className="text-red-400" />
          <span className="text-red-400 font-semibold tabular-nums">{battery}%</span>
        </div>
      )}
    </HeaderBadge>
  );
}

export function MotionBadge({ entityId, roomKey }: { entityId: `binary_sensor.${string}`; roomKey: string }) {
  const { t } = useTranslation();
  const entity = useHass((s) => s.entities[entityId] as {
    state: string; last_changed: string; attributes: Record<string, unknown>;
  } | undefined);

  const isUnavailable = !entity || entity.state === "unavailable" || entity.state === "unknown";
  const isMotion = entity?.state === "on";
  const elapsedSeconds = useElapsedSince(entity?.last_changed, !isUnavailable && !isMotion);
  const isRecent = !isMotion && !isUnavailable && elapsedSeconds < MOTION_GRACE_PERIOD_S;
  const isActive = isMotion || isRecent;
  const roomLabel = t(`room.${roomKey}` as Parameters<typeof t>[0]);

  return (
    <HeaderBadge title={roomLabel} variant={isActive ? "warning" : "default"}>
      <Icon path={mdiMotionSensor} size={0.55} className={cn("transition-colors", isUnavailable ? "text-slate-600" : isActive ? "text-amber-400" : "text-slate-400")} />
      {isUnavailable ? (
        <span className="text-slate-600">–</span>
      ) : isActive ? (
        <span className="font-semibold text-amber-400">{t("header.motion.detected")}</span>
      ) : (
        <span className="tabular-nums text-slate-400">
          {t("header.motion.clear")} <span className="font-semibold text-slate-300">{formatElapsed(elapsedSeconds)}</span>
        </span>
      )}
    </HeaderBadge>
  );
}
