import { HaStatusIndicator } from "@/components/ha/HaStatusIndicator";
import { SystemMetricBadge } from "@/components/layout/SystemMetricBadge";
import { useMetricHistory } from "@/hooks/useMetricHistory";
import { useSystemVitals } from "@/hooks/useSystemVitals";
import { HA_CONFIGURED } from "@/lib/ha/config";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useLanguageStore } from "@/stores/languageStore";
import { cn } from "@/lib/utils";

/** Desktop header vitals — hostname + CPU/RAM sparklines */
function HeaderVitals() {
  const { data } = useSystemVitals();
  const cpuHistory = useMetricHistory(data?.cpuLoadPercent ?? null);
  const ramHistory = useMetricHistory(data?.memoryUsedPercent ?? null);
  const hostname = "Manny";

  if (!data) return null;

  return (
    <div className="hidden md:flex items-center gap-4 border border-slate-700 bg-slate-800 text-xs text-slate-400 px-2 py-1 rounded">
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

/** Mobile-only compact vitals badge — just CPU% + RAM%, no sparklines */
function MobileVitalsBadge() {
  const { data } = useSystemVitals();

  if (!data) return null;

  return (
    <div className="flex md:hidden items-center gap-2 border border-slate-700 bg-slate-800 text-xs px-2 py-0.5 rounded">
      <span className={cn(
        "font-semibold tabular-nums",
        data.cpuLoadPercent >= 85 ? "text-red-400" : data.cpuLoadPercent >= 60 ? "text-amber-400" : "text-emerald-400"
      )}>
        {data.cpuLoadPercent}%
      </span>
      <span className="text-slate-600">|</span>
      <span className={cn(
        "font-semibold tabular-nums",
        data.memoryUsedPercent >= 85 ? "text-red-400" : data.memoryUsedPercent >= 60 ? "text-amber-400" : "text-emerald-400"
      )}>
        {data.memoryUsedPercent}%
      </span>
    </div>
  );
}

/**
 * Header component
 * Desktop: full header with vitals sparklines, HA status, language toggle, version
 * Mobile: compact single-line — logo left, CPU/RAM badge right
 */
export function Header() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguageStore();

  return (
    <header className="flex items-center justify-between h-10 md:h-16 px-3 md:px-6 border-b border-slate-700 bg-slate-950 shrink-0">
      <div className="flex items-center gap-4 md:gap-6">
        <h1 className="text-base md:text-2xl font-bold text-slate-100">{t("appTitle")}</h1>
        <HeaderVitals />
      </div>
      <div className="flex items-center gap-2 md:gap-4">
        {/* Mobile: compact badge only */}
        <MobileVitalsBadge />
        {/* Desktop: full controls */}
        {HA_CONFIGURED && (
          <div className="hidden md:block">
            <HaStatusIndicator />
          </div>
        )}
        <button
          onClick={() => setLanguage(language === "de" ? "en" : "de")}
          className="hidden md:block text-xs font-medium text-slate-400 hover:text-slate-100 transition-colors px-2 py-1 rounded border border-slate-700 hover:border-slate-500"
          aria-label="Switch language"
        >
          {t("lang.switch")}
        </button>
        <div className="hidden md:block text-sm text-slate-400">{t("appVersion")}</div>
      </div>
    </header>
  );
}
