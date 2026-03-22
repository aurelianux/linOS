import { SystemInfoPanel } from "@/components/panels/SystemInfoPanel";
import { DockerPanel } from "@/components/panels/DockerPanel";
import { useTranslation } from "@/lib/i18n/useTranslation";

export function AdminPage() {
  const { t } = useTranslation();
  return (
    <div className="p-4 md:p-6 space-y-5">
      <div>
        <h2 className="text-2xl font-bold text-slate-100">{t("nav.admin")}</h2>
        <p className="text-sm text-slate-400">{t("admin.subtitle")}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SystemInfoPanel />
        <DockerPanel />
      </div>
    </div>
  );
}
