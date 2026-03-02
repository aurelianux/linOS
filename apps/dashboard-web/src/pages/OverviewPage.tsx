import { ServiceStatusCard } from "../components/common/ServiceStatusCard";
import { HaStatusCard } from "../components/ha/HaStatusCard";

const HA_CONFIGURED = !!(
  import.meta.env.VITE_HA_URL && import.meta.env.VITE_HA_TOKEN
);

/**
 * Overview page – shows all stack statuses and HA connection state.
 */
export function OverviewPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-100 mb-2">Overview</h2>
        <p className="text-slate-400">Welcome to linBoard v0.1</p>
      </div>

      <ServiceStatusCard />

      <HaStatusCard haConfigured={HA_CONFIGURED} />
    </div>
  );
}
