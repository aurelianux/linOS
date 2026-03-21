import { HaStatusIndicator } from "@/components/ha/HaStatusIndicator";
import { SystemMetricBadge } from "@/components/layout/SystemMetricBadge";
import { useMetricHistory } from "@/hooks/useMetricHistory";
import { useSystemVitals } from "@/hooks/useSystemVitals";
import { HA_CONFIGURED } from "@/lib/ha/config";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useLanguageStore } from "@/stores/languageStore";

function HeaderVitals() {
  const { data } = useSystemVitals();
  const cpuHistory = useMetricHistory(data?.cpuLoadPercent ?? null);
  const ramHistory = useMetricHistory(data?.memoryUsedPercent ?? null);
  const hostname = "Manny";

  if (!data) return null;

  return (
    <div className="flex items-center gap-4 border border-slate-700 bg-slate-800 text-xs text-slate-400 px-2 py-1 rounded ">
      <div className="text-slate-200">{hostname}</div>
      <div className="flex items-center gap-4">
      <SystemMetricBadge
        label="CPU"
        percent={data.cpuLoadPercent}
        history={cpuHistory}
      />
      <SystemMetricBadge
        label="RAM"
        percent={data.memoryUsedPercent}
        history={ramHistory}
        />
      </div>
    </div>
  );
}

/**
 * Header component - app title and top-level branding
 */
export function Header() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguageStore();

  return (
    <header className="flex items-center justify-between h-16 px-6 border-b border-slate-700 bg-slate-950 shrink-0">
      <div className="flex items-center gap-6">
        <h1 className="text-2xl font-bold text-slate-100">{t("appTitle")}</h1>
        <HeaderVitals />
      </div>
      <div className="flex items-center gap-4">
        {HA_CONFIGURED && <HaStatusIndicator />}
        <button
          onClick={() => setLanguage(language === "de" ? "en" : "de")}
          className="text-xs font-medium text-slate-400 hover:text-slate-100 transition-colors px-2 py-1 rounded border border-slate-700 hover:border-slate-500"
          aria-label="Switch language"
        >
          {t("lang.switch")}
        </button>
        <div className="text-sm text-slate-400">{t("appVersion")}</div>
      </div>
    </header>
  );
}
