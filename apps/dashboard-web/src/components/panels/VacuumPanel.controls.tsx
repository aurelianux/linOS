import { mdiHome, mdiPause, mdiPlay, mdiStop } from "@mdi/js";
import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface VacuumActiveControlsProps {
  isActive: boolean;
  showStartingState: boolean;
  isRoutineActive: boolean;
  currentStepIndex: number | undefined;
  totalSteps: number | undefined;
  currentStepRooms: string;
  isCleaning: boolean;
  isPaused: boolean;
  isUnavailable: boolean;
  isDocked: boolean;
  onPause: () => void;
  onResume: () => void;
  onStop: () => void;
  onDock: () => void;
}

export function VacuumActiveControls({
  isActive, showStartingState, isRoutineActive, currentStepIndex, totalSteps,
  currentStepRooms, isCleaning, isPaused, isUnavailable, isDocked,
  onPause, onResume, onStop, onDock,
}: VacuumActiveControlsProps) {
  const { t } = useTranslation();
  return (
    <>
      {showStartingState && (
        <div className="w-full py-3 rounded-lg text-sm font-semibold text-center bg-slate-800 text-slate-400 border border-slate-700 animate-pulse">
          {t("roborock.state.starting")}
        </div>
      )}

      {isActive && !showStartingState && (
        <div className="space-y-3">
          {isRoutineActive && currentStepIndex !== undefined && totalSteps !== undefined && (
            <div className="p-3 bg-slate-800/50 rounded-lg border border-slate-700 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-slate-200">
                  {t("vacuum.stepProgress", { current: String(currentStepIndex + 1), total: String(totalSteps) })}
                </span>
              </div>
              {currentStepRooms && <p className="text-xs text-slate-400 mt-1">{currentStepRooms}</p>}
            </div>
          )}
          <div className="flex gap-2">
            {isCleaning && (
              <Button variant="secondary" size="sm" className="flex-1" onClick={onPause}>
                <Icon path={mdiPause} size={0.7} className="mr-1" />
                {t("roborock.pause")}
              </Button>
            )}
            {isPaused && (
              <Button variant="secondary" size="sm" className="flex-1 bg-amber-400 hover:bg-amber-300 text-slate-950" onClick={onResume}>
                <Icon path={mdiPlay} size={0.7} className="mr-1" />
                {t("roborock.resume")}
              </Button>
            )}
            <Button variant="secondary" size="sm" className="flex-1" onClick={onStop}>
              <Icon path={mdiStop} size={0.7} className="mr-1" />
              {t("roborock.stop")}
            </Button>
            <Button variant="secondary" size="sm" className="flex-1" onClick={onDock}>
              <Icon path={mdiHome} size={0.7} className="mr-1" />
              {t("roborock.dock")}
            </Button>
          </div>
        </div>
      )}

      {!isDocked && !isUnavailable && !isActive && (
        <Button variant="secondary" size="sm" className="w-full" onClick={onDock}>
          <Icon path={mdiHome} size={0.7} className="mr-1" />
          {t("roborock.dock")}
        </Button>
      )}
    </>
  );
}
