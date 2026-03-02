/**
 * Converts a Home Assistant icon string (e.g. "mdi:lightbulb") to the
 * corresponding MDI SVG path from @mdi/js.
 *
 * Uses a dynamic import to avoid bloating the initial bundle with all 7500+ icons.
 * Returns null if the icon string is invalid or the icon cannot be found.
 */
export async function haIconToMdiPathAsync(
  haIcon: string
): Promise<string | null> {
  if (!haIcon.startsWith("mdi:")) return null;

  const iconName = haIcon
    .slice(4) // remove "mdi:" prefix
    .replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()); // kebab-case → camelCase

  const mdiKey = `mdi${iconName.charAt(0).toUpperCase()}${iconName.slice(1)}`;

  try {
    const icons = await import("@mdi/js");
    const path = (icons as Record<string, string | undefined>)[mdiKey];
    return path ?? null;
  } catch {
    return null;
  }
}

/**
 * Synchronous version using a pre-built lookup map for common HA icons.
 * Falls back to null for unknown icons.
 * Use this in render paths where async is not possible.
 */

import {
  mdiLightbulb,
  mdiLightbulbOutline,
  mdiThermometer,
  mdiWaterPercent,
  mdiHome,
  mdiPower,
  mdiTelevision,
  mdiSpeaker,
  mdiFan,
  mdiAirConditioner,
  mdiDoor,
  mdiDoorOpen,
  mdiWindowOpen,
  mdiWindowClosed,
  mdiLock,
  mdiLockOpen,
  mdiMotionSensor,
  mdiSmokeDetector,
  mdiWaterBoiler,
  mdiRobotVacuum,
  mdiBlinds,
  mdiBlindsOpen,
  mdiGarage,
  mdiGarageOpen,
  mdiWeatherSunny,
  mdiWeatherRainy,
  mdiWeatherCloudy,
  mdiFlash,
  mdiBattery,
  mdiWifi,
  mdiDevices,
} from "@mdi/js";

// Direct mapping: HA icon string → MDI SVG path (single source of truth)
const HA_ICON_TO_PATH: Record<string, string> = {
  "mdi:lightbulb": mdiLightbulb,
  "mdi:lightbulb-outline": mdiLightbulbOutline,
  "mdi:thermometer": mdiThermometer,
  "mdi:water-percent": mdiWaterPercent,
  "mdi:home": mdiHome,
  "mdi:power": mdiPower,
  "mdi:television": mdiTelevision,
  "mdi:speaker": mdiSpeaker,
  "mdi:fan": mdiFan,
  "mdi:air-conditioner": mdiAirConditioner,
  "mdi:door": mdiDoor,
  "mdi:door-open": mdiDoorOpen,
  "mdi:window-open": mdiWindowOpen,
  "mdi:window-closed": mdiWindowClosed,
  "mdi:lock": mdiLock,
  "mdi:lock-open": mdiLockOpen,
  "mdi:motion-sensor": mdiMotionSensor,
  "mdi:smoke-detector": mdiSmokeDetector,
  "mdi:water-boiler": mdiWaterBoiler,
  "mdi:robot-vacuum": mdiRobotVacuum,
  "mdi:blinds": mdiBlinds,
  "mdi:blinds-open": mdiBlindsOpen,
  "mdi:garage": mdiGarage,
  "mdi:garage-open": mdiGarageOpen,
  "mdi:weather-sunny": mdiWeatherSunny,
  "mdi:weather-rainy": mdiWeatherRainy,
  "mdi:weather-cloudy": mdiWeatherCloudy,
  "mdi:flash": mdiFlash,
  "mdi:battery": mdiBattery,
  "mdi:wifi": mdiWifi,
  "mdi:devices": mdiDevices,
};

export function haIconToMdiPath(haIcon: string): string | null {
  return HA_ICON_TO_PATH[haIcon] ?? null;
}
