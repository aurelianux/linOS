import { useEntity, useHass } from "@hakit/core";
import { mdiThermometer, mdiWaterPercent } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { cn } from "@/lib/utils";

const BATTERY_LOW_THRESHOLD = 10;

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

/** Compact climate badge for the header status bar. Reusable per room. */
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

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-1.5 py-0.5 rounded transition-shadow",
        isBatteryLow && "ring-1 ring-red-400/60 bg-red-950/20"
      )}
      title={
        isBatteryLow
          ? `${roomLabel}: ${t("header.climate.lowBattery")} (${battery}%)`
          : roomLabel
      }
    >
      <Icon path={icon} size={0.6} className="text-slate-400" />
      <span className="text-xs font-medium text-slate-300">{roomLabel}</span>
      <div className="flex items-center gap-0.5">
        <Icon path={mdiThermometer} size={0.5} className="text-sky-400" />
        <span
          className={cn(
            "text-xs font-semibold tabular-nums",
            temp.isUnavailable ? "text-slate-500" : "text-slate-100"
          )}
        >
          {temp.value}
          {!temp.isUnavailable && (
            <span className="text-slate-500 font-normal">{temp.unit}</span>
          )}
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        <Icon path={mdiWaterPercent} size={0.5} className="text-sky-400" />
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
        <span className="text-xs text-red-400 font-medium tabular-nums">
          {battery}%
        </span>
      )}
    </div>
  );
}

/** Compact mobile climate badge — just room initial + temp value. */
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

  return (
    <span
      className={cn(
        "font-semibold tabular-nums",
        isBatteryLow ? "text-red-400" : "text-slate-300"
      )}
      title={roomLabel}
    >
      {shortLabel} {temp.value}
      {!temp.isUnavailable && <span className="text-slate-500 font-normal text-[10px]">{temp.unit}</span>}
      <span className="text-slate-600 mx-0.5">/</span>
      {humid.value}
      {!humid.isUnavailable && <span className="text-slate-500 font-normal text-[10px]">{humid.unit}</span>}
    </span>
  );
}
