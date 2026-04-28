import { cn } from "@/lib/utils";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import type { RoborockConfig, VacuumRoutine } from "@/lib/api/types";
import { useVacuumPanelState } from "./VacuumPanel.state";
import { VacuumStatusBar, VacuumErrorNotice, VacuumCurrentRoom } from "./VacuumPanel.status";
import { VacuumActiveControls } from "./VacuumPanel.controls";
import { VacuumRoutineBuilder } from "./VacuumPanel.builder";

interface PanelBodyProps {
  config: RoborockConfig;
  routines: VacuumRoutine[];
}

function VacuumPanelBody({ config, routines }: PanelBodyProps) {
  const {
    t, isUnavailable, battery, isCleaning, isPaused, isDocked, isError,
    isRoutineActive, routineState, showStartingState, isActive, stateLabel, stateVariant,
    errorStatus, currentRoomSegment, showCurrentRoom, roomLabelKey, canStart, remainingSeconds,
    currentStepRooms, resolveRoomName,
    segments, selectedDelay, setSelectedDelay, prefillId,
    handlePrefill, handleUpdateSegment, handleDeleteSegment, handleAddSegment, handleStart,
    handlePause, handleResume, handleStop, handleDock,
  } = useVacuumPanelState(config, routines);

  return (
    <div className={cn("space-y-4", isUnavailable && "opacity-50")}>
      <VacuumStatusBar
        battery={battery}
        stateLabel={stateLabel}
        stateVariant={stateVariant}
        isScheduled={isRoutineActive && !!routineState?.scheduledAt && remainingSeconds > 0}
        remainingSeconds={remainingSeconds}
      />
      {isError && errorStatus && <VacuumErrorNotice errorStatus={errorStatus} />}
      {showCurrentRoom && currentRoomSegment && (
        <VacuumCurrentRoom
          roomLabelKey={roomLabelKey}
          segment={currentRoomSegment}
          resolveRoomName={resolveRoomName}
        />
      )}
      <VacuumActiveControls
        isActive={isActive}
        showStartingState={showStartingState}
        isRoutineActive={isRoutineActive}
        currentStepIndex={routineState?.currentStepIndex}
        totalSteps={routineState?.totalSteps}
        currentStepRooms={currentStepRooms}
        isCleaning={isCleaning}
        isPaused={isPaused}
        isUnavailable={isUnavailable}
        isDocked={isDocked}
        onPause={handlePause}
        onResume={handleResume}
        onStop={handleStop}
        onDock={handleDock}
      />
      {!isActive && (
        <VacuumRoutineBuilder
          routines={routines}
          segments={segments}
          prefillId={prefillId}
          selectedDelay={selectedDelay}
          isUnavailable={isUnavailable}
          canStart={canStart}
          config={config}
          onPrefill={handlePrefill}
          onUpdateSegment={handleUpdateSegment}
          onDeleteSegment={handleDeleteSegment}
          onAddSegment={handleAddSegment}
          onStart={handleStart}
          onSetDelay={setSelectedDelay}
        />
      )}
      {isUnavailable && (
        <p className="text-xs text-slate-500 text-center">{t("entity.unavailable")}</p>
      )}
    </div>
  );
}

export function VacuumPanel() {
  const { data: dashConfig } = useDashboardConfig();
  if (!dashConfig?.roborock) return null;
  const routines = dashConfig.vacuum?.routines ?? [];
  return <VacuumPanelBody config={dashConfig.roborock} routines={routines} />;
}
