import { Card, CardContent } from "../ui/card";
import { cn } from "../../lib/utils";
import type { HaState } from "../../lib/api/types";
import { TOGGLEABLE_DOMAINS, entityDomain } from "../../lib/api/types";

interface EntityCardProps {
  state: HaState;
  onToggle?: (entityId: string, currentState: string) => void;
  /** When true, the toggle is disabled (e.g. service call in progress) */
  pending?: boolean;
}

/** Domain → icon mapping (emoji fallback, no external deps) */
const DOMAIN_ICON: Record<string, string> = {
  light: "💡",
  switch: "🔌",
  sensor: "📡",
  binary_sensor: "🔘",
  climate: "🌡️",
  fan: "🌀",
  input_boolean: "🔘",
  automation: "⚙️",
  media_player: "🎵",
};

function domainIcon(domain: string): string {
  return DOMAIN_ICON[domain] ?? "📦";
}

/** Format the state value for display, appending unit if available */
function formatState(state: HaState): string {
  if (state.state === "unavailable") return "Unavailable";
  if (state.state === "unknown") return "Unknown";

  const unit = state.attributes.unit_of_measurement;
  if (unit) return `${state.state} ${unit}`;

  // Friendly booleans
  if (state.state === "on") return "On";
  if (state.state === "off") return "Off";

  return state.state;
}

/**
 * Displays a single Home Assistant entity with its current state.
 * Toggleable entities (lights, switches, etc.) show an interactive toggle.
 */
export function EntityCard({ state, onToggle, pending = false }: EntityCardProps) {
  const domain = entityDomain(state.entity_id);
  const isToggleable = TOGGLEABLE_DOMAINS.has(domain);
  const isOn = state.state === "on";
  const isUnavailable = state.state === "unavailable" || state.state === "unknown";
  const friendlyName =
    state.attributes.friendly_name ?? state.entity_id;

  function handleToggle() {
    if (!isUnavailable && onToggle) {
      onToggle(state.entity_id, state.state);
    }
  }

  return (
    <Card
      className={cn(
        "transition-opacity",
        isUnavailable && "opacity-50"
      )}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-3">
          {/* Icon + Name */}
          <div className="flex items-center gap-3 min-w-0">
            <span className="text-2xl shrink-0" aria-hidden>
              {domainIcon(domain)}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-medium text-slate-100 truncate">
                {friendlyName}
              </p>
              <p className="text-xs text-slate-400 truncate">
                {formatState(state)}
              </p>
            </div>
          </div>

          {/* Toggle */}
          {isToggleable && (
            <button
              role="switch"
              aria-checked={isOn}
              aria-label={`Toggle ${friendlyName}`}
              disabled={isUnavailable || pending}
              onClick={handleToggle}
              className={cn(
                "relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent",
                "transition-colors duration-200 ease-in-out",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
                "disabled:cursor-not-allowed disabled:opacity-50",
                isOn ? "bg-blue-600" : "bg-slate-700"
              )}
            >
              <span
                className={cn(
                  "pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transform transition-transform duration-200 ease-in-out",
                  isOn ? "translate-x-5" : "translate-x-0"
                )}
              />
            </button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
