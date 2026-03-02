import { ServiceStatusCard } from "../components/common/ServiceStatusCard";
import { HaStatusCard } from "../components/ha/HaStatusCard";
import { LightCard } from "../components/ha/LightCard";
import { SwitchCard } from "../components/ha/SwitchCard";
import { SensorCard } from "../components/ha/SensorCard";
import { CardErrorBoundary } from "../components/common/CardErrorBoundary";
import { HA_CONFIGURED } from "@/lib/ha/config";

/**
 * Entity IDs to show in the Quick Controls section.
 * Edit this list to configure which entities appear on the Overview page.
 * Will be driven by a config file in a future iteration.
 */
const QUICK_CONTROL_LIGHTS: Array<`light.${string}`> = [
  // "light.wohnzimmer",
  // "light.schlafzimmer",
];

const QUICK_CONTROL_SWITCHES: Array<
  | `switch.${string}`
  | `input_boolean.${string}`
  | `fan.${string}`
  | `automation.${string}`
> = [
  // "switch.steckdose_buero",
];

const QUICK_CONTROL_SENSORS: Array<`sensor.${string}`> = [
  // "sensor.temperatur_wohnzimmer",
];

const HAS_QUICK_CONTROLS =
  QUICK_CONTROL_LIGHTS.length > 0 ||
  QUICK_CONTROL_SWITCHES.length > 0 ||
  QUICK_CONTROL_SENSORS.length > 0;

/**
 * Overview page – shows all stack statuses, HA connection state,
 * and Quick Controls for configured entities.
 */
export function OverviewPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-100 mb-2">Overview</h2>
        <p className="text-slate-400">Welcome to linBoard v0.1</p>
      </div>

      {/* Quick Controls – only shown when HA is configured and entities are listed */}
      {HA_CONFIGURED && HAS_QUICK_CONTROLS && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-200">
            Quick Controls
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {QUICK_CONTROL_LIGHTS.map((id) => (
              <CardErrorBoundary key={id} entityId={id}>
                <LightCard entityId={id} />
              </CardErrorBoundary>
            ))}
            {QUICK_CONTROL_SWITCHES.map((id) => (
              <CardErrorBoundary key={id} entityId={id}>
                <SwitchCard entityId={id} />
              </CardErrorBoundary>
            ))}
            {QUICK_CONTROL_SENSORS.map((id) => (
              <CardErrorBoundary key={id} entityId={id}>
                <SensorCard entityId={id} />
              </CardErrorBoundary>
            ))}
          </div>
        </div>
      )}

      <ServiceStatusCard />

      <HaStatusCard haConfigured={HA_CONFIGURED} />
    </div>
  );
}
