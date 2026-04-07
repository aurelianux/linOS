import type { DashboardRoom } from "@/lib/api/types";

export function getAirQualityEntityIds(room: DashboardRoom): Set<string> {
  if (!room.airQuality) return new Set();
  return new Set([
    room.airQuality.temperature,
    room.airQuality.humidity,
    ...room.airQuality.secondary,
  ]);
}

/**
 * Determine if a room is "large" (should span full width on desktop).
 * Large rooms have >3 non-air-quality entities.
 */
export function isLargeRoom(room: DashboardRoom): boolean {
  const airQualityIds = getAirQualityEntityIds(room);
  const filteredCount = room.entities.filter((id) => !airQualityIds.has(id)).length;
  return filteredCount > 3;
}
