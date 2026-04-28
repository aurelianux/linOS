import { Icon } from "@/components/ui/icon";
import { NumberStepper } from "@/components/ui/number-stepper";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { cn } from "@/lib/utils";
import { mdiPlay } from "@mdi/js";
import { QUICK_SET_MINUTES } from "./TimerCard.helpers";

interface IdleViewProps {
  inputMinutes: number;
  inputSeconds: number;
  label: string;
  error: string | null;
  onSetMinutes: (v: number) => void;
  onSetSeconds: (v: number) => void;
  onSetLabel: (v: string) => void;
  onStart: () => void;
}

export function IdleView({ inputMinutes, inputSeconds, label, error, onSetMinutes, onSetSeconds, onSetLabel, onStart }: IdleViewProps) {
  const { t } = useTranslation();

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {QUICK_SET_MINUTES.map((mins) => (
          <button
            key={mins}
            type="button"
            onClick={() => { onSetMinutes(mins); onSetSeconds(0); }}
            className="px-3 py-1.5 rounded-lg text-sm font-medium bg-slate-800 text-slate-300 border border-slate-700 hover:bg-slate-700 hover:text-slate-100 transition-colors"
          >
            {mins > 60 ? `${Math.floor(mins / 60)}h ${mins % 60}` : `${mins}`} {t("timer.minuteShort")}
          </button>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <label className="block text-xs text-slate-500 mb-1">{t("timer.minutes")}</label>
          <NumberStepper value={inputMinutes} onChange={onSetMinutes} min={0} max={1440} formatValue={(v) => String(v).padStart(2, "0")} />
        </div>
        <span className="text-slate-500 mt-5 text-lg font-mono">:</span>
        <div className="flex-1">
          <label className="block text-xs text-slate-500 mb-1">{t("timer.seconds")}</label>
          <NumberStepper value={inputSeconds} onChange={onSetSeconds} min={0} max={59} formatValue={(v) => String(v).padStart(2, "0")} />
        </div>
      </div>

      <div>
        <label className="block text-xs text-slate-500 mb-1">{t("timer.label")}</label>
        <input
          type="text"
          maxLength={100}
          value={label}
          onChange={(e) => onSetLabel(e.target.value)}
          placeholder={t("timer.labelPlaceholder")}
          className={cn("w-full px-3 py-2 rounded-lg text-sm bg-slate-800 border border-slate-700 text-slate-100 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-sky-400/50 focus:border-sky-400")}
        />
      </div>

      {error && <p className="text-xs text-red-400">{error}</p>}

      <button type="button" onClick={onStart} className="w-full flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-emerald-400/10 text-emerald-400 hover:bg-emerald-400/20 transition-colors">
        <Icon path={mdiPlay} size={0.8} />
        <span className="text-sm font-medium">{t("timer.start")}</span>
      </button>
    </div>
  );
}
