import { useEntity, useHass } from "@hakit/core";
import { mdiThermometer, mdiWaterPercent, mdiBatteryLow } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { cn } from "@/lib/utils";

const BATTERY_LOW_THRESHOLD = 15;

interface RoomClimateBadgeProps {
  roomKey: string;
  icon: string;
  temperatureEntityId: `sensor.${string}`;
  humidityEntityId: `sensor.${string}`;
  batteryEntityId?: `sensor.${string}`;
}

function useEntityValue(entityId: `sensor.${string}`) {
  const entity = useEntity(entityId, { returnNullIfNotFound: true });
  const isUnavailable =
    !entity ||
    entity.state === "unavailable" ||
    entity.state === "unknown";
  return {
    value: isUnavailable ? "–" : entity.state,
    numericValue: isUnavailable ? null : Number(entity.state),
    unit: entity?.attributes.unit_of_measurement ?? "",
    isUnavailable,
  };
}

/**
 * Read battery level directly from the useHass Zustand store instead of
 * useEntity. Calling useEntity with a fake/noop entity ID crashes
 * @hakit/core (it creates internal subscriptions that access .id on
 * undefined entities). The store read is safe for missing entities.
 */
function useBatteryLevel(entityId: `sensor.${string}` | undefined): number | null {
  const state = useHass((s) =>
    entityId ? (s.entities[entityId]?.state as string | undefined) : undefined
  );
  if (!entityId || !state || state === "unavailable" || state === "unknown") {
    return null;
  }
  return Number(state);
}

/**
 * Returns a Tailwind text color class based on temperature (°C).
 * Gradient: cold blue → cool sky → neutral slate → warm amber → hot red
 */
function getTemperatureColor(temp: number | null): string {
  if (temp === null) return "text-slate-500";
  if (temp <= 16) return "text-blue-400";
  if (temp <= 19) return "text-sky-400";
  if (temp <= 22) return "text-emerald-400";
  if (temp <= 25) return "text-amber-400";
  return "text-red-400";
}

/** Compact climate badge rendered as a separate header card. */
export function RoomClimateBadge({
  roomKey,
  icon,
  temperatureEntityId,
  humidityEntityId,
  batteryEntityId,
}: RoomClimateBadgeProps) {
  const { t } = useTranslation();
  const temp = useEntityValue(temperatureEntityId);
  const humid = useEntityValue(humidityEntityId);
  const battery = useBatteryLevel(batteryEntityId);

  const isBatteryLow = battery !== null && battery < BATTERY_LOW_THRESHOLD;
  const roomLabel = t(`room.${roomKey}` as Parameters<typeof t>[0]);
  const tempColor = getTemperatureColor(temp.numericValue);

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded border border-slate-700 bg-slate-800",
        isBatteryLow && "border-red-400/60"
      )}
      title={
        isBatteryLow
          ? `${roomLabel}: ${t("header.climate.lowBattery")} (${battery}%)`
          : roomLabel
      }
    >
      <Icon path={icon} size={0.55} className="text-slate-400" />
      <div className="flex items-center gap-0.5">
        <Icon path={mdiThermometer} size={0.45} className={tempColor} />
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            temp.isUnavailable ? "text-slate-500" : tempColor
          )}
        >
          {temp.value}
          {!temp.isUnavailable && (
            <span className="text-slate-500 font-normal">{temp.unit}</span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        <Icon path={mdiWaterPercent} size={0.45} className="text-sky-400" />
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            humid.isUnavailable ? "text-slate-500" : "text-slate-100"
          )}
        >
          {humid.value}
          {!humid.isUnavailable && (
            <span className="text-slate-500 font-normal">{humid.unit}</span>
          )}
        </span>
      </div>
      {isBatteryLow && (
        <div className="flex items-center gap-0.5">
          <Icon path={mdiBatteryLow} size={0.45} className="text-red-400" />
          <span className="text-xs text-red-400 font-semibold tabular-nums">
            {battery}%
          </span>
        </div>
      )}
    </div>
  );
}

/** Compact mobile climate badge — room short label + temp + humidity. */
export function MobileClimateBadge({
  roomKey,
  temperatureEntityId,
  humidityEntityId,
  batteryEntityId,
}: Omit<RoomClimateBadgeProps, "icon">) {
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
      className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded border border-slate-700 bg-slate-800",
        isBatteryLow && "border-red-400/60"
      )}
      title={roomLabel}
    >
      <span className="text-slate-400 text-xs font-medium">{shortLabel}</span>
      <span
        className={cn(
          "font-semibold tabular-nums text-xs",
          temp.isUnavailable ? "text-slate-500" : tempColor
        )}
      >
        {temp.value}
        {!temp.isUnavailable && <span className="text-slate-500 font-normal text-[10px]">{temp.unit}</span>}
      </span>
      <span className="text-slate-600">/</span>
      <span
        className={cn(
          "font-semibold tabular-nums text-xs",
          humid.isUnavailable ? "text-slate-500" : "text-slate-100"
        )}
      >
        {humid.value}
        {!humid.isUnavailable && <span className="text-slate-500 font-normal text-[10px]">{humid.unit}</span>}
      </span>
      {isBatteryLow && (
        <span className="text-xs text-red-400 font-semibold tabular-nums">
          {battery}%
        </span>
      )}
    </div>
  );
}
