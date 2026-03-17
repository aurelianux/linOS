import { ServiceStatusCard } from "../components/common/ServiceStatusCard";
import { HaStatusCard } from "../components/ha/HaStatusCard";
import { LightCard } from "../components/ha/LightCard";
import { SwitchCard } from "../components/ha/SwitchCard";
import { SensorCard } from "../components/ha/SensorCard";
import { QuickActionBar } from "../components/ha/QuickActionBar";
import { CardErrorBoundary } from "../components/common/CardErrorBoundary";
import { HA_CONFIGURED } from "@/lib/ha/config";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";

/**
 * Entity IDs to show in the Quick Controls section.
 * Edit this list to configure which entities appear on the Overview page.
 */
const QUICK_CONTROL_LIGHTS: Array<`light.${string}`> = [];

const QUICK_CONTROL_SWITCHES: Array<
  | `switch.${string}`
  | `input_boolean.${string}`
  | `fan.${string}`
  | `automation.${string}`
> = [];

const QUICK_CONTROL_SENSORS: Array<`sensor.${string}`> = [];

const HAS_QUICK_CONTROLS =
  QUICK_CONTROL_LIGHTS.length > 0 ||
  QUICK_CONTROL_SWITCHES.length > 0 ||
  QUICK_CONTROL_SENSORS.length > 0;

/**
 * Overview page – shows mode quick actions, stack statuses, and HA connection state.
 */
export function OverviewPage() {
  const { t } = useTranslation();
  const { data: dashConfig } = useDashboardConfig();
  const quickActions = dashConfig?.quickActions ?? [];

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-100 mb-2">{t("overview.title")}</h2>
        <p className="text-slate-400">{t("overview.subtitle")}</p>
      </div>

      {/* Quick Actions (mode scripts) – driven by dashboard config */}
      {HA_CONFIGURED && quickActions.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-200">
            {t("overview.quickActions")}
          </h3>
          <QuickActionBar actions={quickActions} />
        </div>
      )}

      {/* Quick Controls – legacy static entity list */}
      {HA_CONFIGURED && HAS_QUICK_CONTROLS && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-slate-200">
            {t("overview.quickControls")}
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
