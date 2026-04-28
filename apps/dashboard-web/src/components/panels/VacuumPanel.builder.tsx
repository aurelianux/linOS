import { mdiPlus } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { VacuumSegmentCard, type EditableSegment } from "./VacuumSegmentCard";
import type { RoborockConfig, VacuumRoutine } from "@/lib/api/types";
import { SCHEDULE_PRESETS } from "./VacuumPanel.helpers";

interface VacuumRoutineBuilderProps {
  routines: VacuumRoutine[];
  segments: EditableSegment[];
  prefillId: string | null;
  selectedDelay: number;
  isUnavailable: boolean;
  canStart: boolean;
  config: RoborockConfig;
  onPrefill: (routine: VacuumRoutine) => void;
  onUpdateSegment: (index: number, updated: EditableSegment) => void;
  onDeleteSegment: (index: number) => void;
  onAddSegment: () => void;
  onStart: () => void;
  onSetDelay: (delay: number) => void;
}

export function VacuumRoutineBuilder({
  routines, segments, prefillId, selectedDelay, isUnavailable, canStart, config,
  onPrefill, onUpdateSegment, onDeleteSegment, onAddSegment, onStart, onSetDelay,
}: VacuumRoutineBuilderProps) {
  const { t } = useTranslation();
  return (
    <>
      {routines.length > 0 && (
        <div className="flex gap-2">
          {routines.map((routine) => (
            <button
              key={routine.id}
              type="button"
              disabled={isUnavailable}
              onClick={() => onPrefill(routine)}
              className={cn(
                "flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 border select-none",
                prefillId === routine.id
                  ? "bg-slate-700 text-slate-100 border-slate-500"
                  : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200",
                isUnavailable && "opacity-50 cursor-not-allowed"
              )}
            >
              {routine.label}
            </button>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {segments.map((seg, i) => (
          <VacuumSegmentCard
            key={seg.id}
            segment={seg}
            index={i}
            canDelete={segments.length > 1}
            disabled={isUnavailable}
            config={config}
            onUpdate={(updated) => onUpdateSegment(i, updated)}
            onDelete={() => onDeleteSegment(i)}
          />
        ))}
      </div>

      <button
        type="button"
        disabled={isUnavailable}
        onClick={onAddSegment}
        className={cn(
          "w-full py-2 rounded-lg text-xs font-medium transition-colors",
          "border border-dashed border-slate-700 text-slate-500",
          "hover:border-slate-500 hover:text-slate-400",
          isUnavailable && "opacity-50 cursor-not-allowed"
        )}
      >
        <Icon path={mdiPlus} size={0.55} className="mr-1 inline-block align-middle" />
        {t("vacuum.addSegment")}
      </button>

      <div className="space-y-1.5">
        <span className="text-xs text-slate-500">{t("vacuum.scheduleStart")}</span>
        <div className="flex flex-wrap gap-1.5">
          {SCHEDULE_PRESETS.map((preset) => (
            <button
              key={preset.delayMs}
              type="button"
              disabled={isUnavailable}
              onClick={() => onSetDelay(preset.delayMs)}
              className={cn(
                "px-3 py-1.5 rounded-md text-xs font-medium transition-colors",
                selectedDelay === preset.delayMs ? "bg-slate-700 text-slate-100" : "bg-slate-800 text-slate-500 hover:text-slate-400",
                isUnavailable && "opacity-50 cursor-not-allowed"
              )}
            >
              {t(preset.labelKey)}
            </button>
          ))}
        </div>
      </div>

      <button
        type="button"
        disabled={!canStart}
        onClick={onStart}
        className={cn(
          "w-full py-3 rounded-lg text-sm font-semibold transition-all duration-200 border select-none",
          canStart
            ? "bg-amber-400 text-slate-950 border-amber-400 hover:bg-amber-300 active:bg-amber-500"
            : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
        )}
      >
        {t("roborock.start")}
      </button>
    </>
  );
}
