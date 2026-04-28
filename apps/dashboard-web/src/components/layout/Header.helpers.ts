import { useState, useEffect } from "react";
import type { DashboardRoom, AirQualityConfig } from "@/lib/api/types";

export const MOTION_GRACE_PERIOD_S = 10;

export function extractBatteryEntityId(secondary: Array<`sensor.${string}`>): `sensor.${string}` | undefined {
  return secondary.find((id) => id.endsWith("_battery"));
}

export function getClimateRooms(rooms: DashboardRoom[]): Array<{ room: DashboardRoom; airQuality: AirQualityConfig }> {
  return rooms
    .filter((r): r is DashboardRoom & { airQuality: AirQualityConfig } => !!r.airQuality)
    .map((r) => ({ room: r, airQuality: r.airQuality }));
}

export function formatElapsed(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export function useElapsedSince(lastChanged: string | undefined, shouldTick: boolean): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    function compute() {
      if (!lastChanged) return 0;
      return Math.max(0, Math.floor((Date.now() - new Date(lastChanged).getTime()) / 1000));
    }
    const initialId = setTimeout(() => setElapsed(compute()), 0);
    if (!shouldTick) return () => clearTimeout(initialId);
    const id = setInterval(() => setElapsed(compute()), 1000);
    return () => { clearTimeout(initialId); clearInterval(id); };
  }, [lastChanged, shouldTick]);

  return elapsed;
}
