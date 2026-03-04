import type { ComponentType } from "react";
import { LightCard } from "./LightCard";
import { SwitchCard } from "./SwitchCard";
import { SensorCard } from "./SensorCard";
import { GenericEntityCard } from "./GenericEntityCard";

// Domains handled by SwitchCard
const SWITCH_DOMAINS = new Set([
  "switch",
  "input_boolean",
  "fan",
  "automation",
]);

/**
 * Returns the appropriate HA card component for a given entity domain.
 *
 * Mapping:
 * - `light`         → LightCard
 * - `switch` / `input_boolean` / `fan` / `automation` → SwitchCard
 * - `sensor`        → SensorCard
 * - everything else → GenericEntityCard (read-only fallback)
 */
export function getCardForDomain(
  domain: string
): ComponentType<{ entityId: string }> {
  if (domain === "light") {
    return LightCard as ComponentType<{ entityId: string }>;
  }
  if (SWITCH_DOMAINS.has(domain)) {
    return SwitchCard as ComponentType<{ entityId: string }>;
  }
  if (domain === "sensor") {
    return SensorCard as ComponentType<{ entityId: string }>;
  }
  return GenericEntityCard;
}
