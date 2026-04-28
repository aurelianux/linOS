import { mdiThermometer, mdiWaterPercent, mdiBatteryLow } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { cn } from "@/lib/utils";
import {
  BATTERY_LOW_THRESHOLD,
  useEntityValue,
  useBatteryLevel,
  getTemperatureColor,
} from "./RoomClimateBadge.helpers";

interface RoomClimateBadgeProps {
  roomKey: string;
  icon: string;
  temperatureEntityId: `sensor.${string}`;
  humidityEntityId: `sensor.${string}`;
  batteryEntityId?: `sensor.${string}`;
}

export function RoomClimateBadge({ roomKey, icon, temperatureEntityId, humidityEntityId, batteryEntityId }: RoomClimateBadgeProps) {
  const { t } = useTranslation();
  const temp = useEntityValue(temperatureEntityId);
  const humid = useEntityValue(humidityEntityId);
  const battery = useBatteryLevel(batteryEntityId);

  const isBatteryLow = battery !== null && battery < BATTERY_LOW_THRESHOLD;
  const roomLabel = t(`room.${roomKey}` as Parameters<typeof t>[0]);
  const tempColor = getTemperatureColor(temp.numericValue);

  return (
    <div
      className={cn("flex items-center gap-1.5 px-2 py-1 rounded border border-slate-700 bg-slate-800", isBatteryLow && "border-red-400/60")}
      title={isBatteryLow ? `${roomLabel}: ${t("header.climate.lowBattery")} (${battery}%)` : roomLabel}
    >
      <Icon path={icon} size={0.55} className="text-slate-400" />
      <div className="flex items-center gap-0.5">
        <Icon path={mdiThermometer} size={0.45} className={tempColor} />
        <span className={cn("text-xs font-semibold tabular-nums", temp.isUnavailable ? "text-slate-500" : tempColor)}>
          {temp.value}
          {!temp.isUnavailable && <span className="text-slate-500 font-normal">{temp.unit}</span>}
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        <Icon path={mdiWaterPercent} size={0.45} className="text-sky-400" />
        <span className={cn("text-xs font-semibold tabular-nums", humid.isUnavailable ? "text-slate-500" : "text-slate-100")}>
          {humid.value}
          {!humid.isUnavailable && <span className="text-slate-500 font-normal">{humid.unit}</span>}
        </span>
      </div>
      {isBatteryLow && (
        <div className="flex items-center gap-0.5">
          <Icon path={mdiBatteryLow} size={0.45} className="text-red-400" />
          <span className="text-xs text-red-400 font-semibold tabular-nums">{battery}%</span>
        </div>
      )}
    </div>
  );
}

export function MobileClimateBadge({ roomKey, temperatureEntityId, humidityEntityId, batteryEntityId }: Omit<RoomClimateBadgeProps, "icon">) {
  const { t } = useTranslation();
  const temp = useEntityValue(temperatureEntityId);
  const humid = useEntityValue(humidityEntityId);
  const battery = useBatteryLevel(batteryEntityId);

  const isBatteryLow = battery !== null && battery < BATTERY_LOW_THRESHOLD;
  const roomLabel = t(`room.${roomKey}` as Parameters<typeof t>[0]);
  const shortLabel = roomLabel.slice(0, 2);
  const tempColor = getTemperatureColor(temp.numericValue);

  return (
    <div
      className={cn("flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800", isBatteryLow && "border-red-400/60")}
      title={roomLabel}
    >
      <span className="text-slate-400 text-xs font-medium">{shortLabel}</span>
      <span className={cn("font-semibold tabular-nums text-xs", temp.isUnavailable ? "text-slate-500" : tempColor)}>
        {temp.value}
        {!temp.isUnavailable && <span className="text-slate-500 font-normal text-[10px]">{temp.unit}</span>}
      </span>
      <span className="text-slate-600">/</span>
      <span className={cn("font-semibold tabular-nums text-xs", humid.isUnavailable ? "text-slate-500" : "text-slate-100")}>
        {humid.value}
        {!humid.isUnavailable && <span className="text-slate-500 font-normal text-[10px]">{humid.unit}</span>}
      </span>
      {isBatteryLow && <span className="text-xs text-red-400 font-semibold tabular-nums">{battery}%</span>}
    </div>
  );
}
