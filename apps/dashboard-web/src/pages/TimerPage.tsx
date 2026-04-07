import TimerCard from "@/components/panels/TimerCard";
import { useTranslation } from "@/lib/i18n/useTranslation";

/**
 * Dedicated timer page — accessible via the "Uhr" nav entry.
 * Moved from SmarthomePage to reduce clutter on the dashboard.
 */
export function TimerPage() {
  const { t } = useTranslation();

  return (
    <div className="p-4 md:p-6 space-y-5">
      <h2 className="text-2xl font-bold text-slate-100">
        {t("nav.timer")}
      </h2>
      <div className="rounded-lg border border-slate-800 bg-slate-900 p-4">
        <TimerCard />
      </div>
    </div>
  );
}
