import {
  mdiHome,
  mdiDoorOpen,
  mdiWeatherNight,
  mdiWeatherSunny,
  mdiSofa,
  mdiKitchen,
  mdiBed,
  mdiHomeVariant,
  mdiLightbulb,
} from "@mdi/js";

/**
 * Maps MDI icon name strings (as stored in dashboard.json) to their SVG path data.
 * Add entries here whenever a new icon is used in config/dashboard.json.
 */
const DASHBOARD_ICON_MAP: Record<string, string> = {
  mdiHome,
  mdiDoorOpen,
  mdiWeatherNight,
  mdiWeatherSunny,
  mdiSofa,
  mdiKitchen,
  mdiBed,
  mdiHomeVariant,
  mdiLightbulb,
};

/** Resolve an MDI icon name from dashboard config to its SVG path. Falls back to mdiLightbulb. */
export function resolveDashboardIcon(name: string): string {
  return DASHBOARD_ICON_MAP[name] ?? mdiLightbulb;
}
