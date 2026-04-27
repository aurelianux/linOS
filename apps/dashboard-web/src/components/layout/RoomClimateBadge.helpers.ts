import { useEntity, useHass } from "@hakit/core";

export const BATTERY_LOW_THRESHOLD = 15;

export function useEntityValue(entityId: `sensor.${string}`) {
  const entity = useEntity(entityId, { returnNullIfNotFound: true });
  const isUnavailable = !entity || entity.state === "unavailable" || entity.state === "unknown";
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
export function useBatteryLevel(entityId: `sensor.${string}` | undefined): number | null {
  const state = useHass((s) =>
    entityId ? (s.entities[entityId]?.state as string | undefined) : undefined
  );
  if (!entityId || !state || state === "unavailable" || state === "unknown") return null;
  return Number(state);
}

export function getTemperatureColor(temp: number | null): string {
  if (temp === null) return "text-slate-500";
  if (temp <= 16) return "text-blue-400";
  if (temp <= 19) return "text-sky-400";
  if (temp <= 22) return "text-emerald-400";
  if (temp <= 25) return "text-amber-400";
  return "text-red-400";
}
