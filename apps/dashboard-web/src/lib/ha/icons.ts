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
  mdiCog,
  mdiAlert,
  mdiCheckCircle,
  mdiClockOutline,
  mdiMapMarker,
  mdiAccount,
  mdiCar,
  mdiEye,
  mdiEyeOff,
  mdiSunglasses,
  mdiMusicNote,
  mdiVolumeHigh,
  mdiVolumeMedium,
  mdiVolumeLow,
  mdiVolumeMute,
} from "@mdi/js";

/**
 * Direct mapping of Home Assistant icon strings (e.g. "mdi:lightbulb")
 * to their MDI SVG path from @mdi/js.
 *
 * Only named imports are used here – tree-shaking ensures unused paths
 * are not included in the bundle.
 *
 * For icons not in this map, EntityIcon falls back to mdiDevices.
 */
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
  "mdi:cog": mdiCog,
  "mdi:alert": mdiAlert,
  "mdi:check-circle": mdiCheckCircle,
  "mdi:clock-outline": mdiClockOutline,
  "mdi:map-marker": mdiMapMarker,
  "mdi:account": mdiAccount,
  "mdi:car": mdiCar,
  "mdi:eye": mdiEye,
  "mdi:eye-off": mdiEyeOff,
  "mdi:sunglasses": mdiSunglasses,
  "mdi:music-note": mdiMusicNote,
  "mdi:volume-high": mdiVolumeHigh,
  "mdi:volume-medium": mdiVolumeMedium,
  "mdi:volume-low": mdiVolumeLow,
  "mdi:volume-mute": mdiVolumeMute,
};

/**
 * Converts a Home Assistant icon string (e.g. "mdi:lightbulb") to its
 * corresponding MDI SVG path. Returns null for unknown icons –
 * callers should fall back to mdiDevices.
 */
export function haIconToMdiPath(haIcon: string): string | null {
  return HA_ICON_TO_PATH[haIcon] ?? null;
}

