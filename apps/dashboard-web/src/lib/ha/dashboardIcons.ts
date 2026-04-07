import {
  mdiSofa,
  mdiStove,
  mdiBed,
  mdiHomeVariant,
  mdiLightbulb,
  mdiLightbulbGroup,
  mdiMotionSensor,
  mdiShower,
} from "@mdi/js";

/**
 * Maps MDI icon name strings (as stored in dashboard.json) to their SVG path data.
 * Add entries here whenever a new icon is used in config/dashboard.json.
 */
const DASHBOARD_ICON_MAP: Record<string, string> = {
  mdiSofa,
  mdiStove,
  mdiBed,
  mdiHomeVariant,
  mdiLightbulb,
  mdiLightbulbGroup,
  mdiMotionSensor,
  mdiShower,
};

/** Resolve an MDI icon name from dashboard config to its SVG path. Falls back to mdiLightbulb. */
export function resolveDashboardIcon(name: string): string {
  return DASHBOARD_ICON_MAP[name] ?? mdiLightbulb;
}
