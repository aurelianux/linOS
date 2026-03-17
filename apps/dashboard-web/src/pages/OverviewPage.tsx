import { ServiceStatusCard } from "../components/common/ServiceStatusCard";
import { HaStatusCard } from "../components/ha/HaStatusCard";
import { HA_CONFIGURED } from "@/lib/ha/config";
import { useTranslation } from "@/lib/i18n/useTranslation";

/**
 * Overview page – shows stack statuses and HA connection state.
 */
export function OverviewPage() {
  const { t } = useTranslation();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-100 mb-2">{t("overview.title")}</h2>
        <p className="text-slate-400">{t("overview.subtitle")}</p>
      </div>

      <ServiceStatusCard />

      <HaStatusCard haConfigured={HA_CONFIGURED} />
    </div>
  );
}
