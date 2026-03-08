import { SystemInfoPanel } from "@/components/panels/SystemInfoPanel";
import { DockerPanel } from "@/components/panels/DockerPanel";
import { useTranslation } from "@/lib/i18n/useTranslation";

/**
 * Panels page – information-dense widgets for the power-user view.
 *
 * Layout: single column on mobile, 2 columns on lg+ screens.
 * Each panel manages its own data fetching and auto-refresh (30 s interval).
 */
export function PanelsPage() {
  const { t } = useTranslation();
  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-100 mb-2">{t("panels.title")}</h2>
        <p className="text-slate-400">{t("panels.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <SystemInfoPanel />
        <DockerPanel />
      </div>
    </div>
  );
}
