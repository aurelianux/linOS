import { CardErrorBoundary } from "@/components/common/CardErrorBoundary";
import { CollapsiblePanel } from "@/components/common/CollapsiblePanel";
import { CompactRoomCard } from "@/components/ha/CompactRoomCard";
import { isLargeRoom } from "@/components/ha/roomHelpers";
import { QuickAccessPanel } from "@/components/ha/QuickAccessPanel";
import { AutomationsPanel } from "@/components/panels/AutomationsPanel";
import {
  RoborockQuickPanel,
} from "@/components/panels/RoborockQuickPanel";
import { isVacuumActiveState } from "@/components/panels/roborockState";
import { VacuumRoutinePanel } from "@/components/panels/VacuumRoutinePanel";
import TimerCard from "@/components/panels/TimerCard";
import { Icon } from "@/components/ui/icon";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useTimerSocket } from "@/hooks/useTimerSocket";
import { useVacuumRoutineSocket } from "@/hooks/useVacuumRoutineSocket";
import type { DashboardRoom, QuickToggleConfig } from "@/lib/api/types";
import { HA_CONFIGURED } from "@/lib/ha/config";
import { resolveDashboardIcon } from "@/lib/ha/dashboardIcons";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { cn } from "@/lib/utils";
import { useHass } from "@hakit/core";
import { mdiLightbulbGroup, mdiLightbulbOff, mdiRobotVacuum, mdiTimer } from "@mdi/js";
import { useCallback, useState } from "react";

function buildQuickToggleMap(
  quickToggles: QuickToggleConfig | undefined
): Map<string, `input_select.${string}`> {
  if (!quickToggles) return new Map();
  return new Map(
    quickToggles.rooms.map((r) => [r.roomId, r.entity])
  );
}

function buildRoomLayout(rooms: DashboardRoom[]): Array<{
  room: DashboardRoom;
  spanFull: boolean;
}> {
  return rooms.map((room) => ({
    room,
    spanFull: isLargeRoom(room),
  }));
}

/** Header action button: sets the global entity to "aus" (all lights off). */
function AllOffButton({ entityId }: { entityId: `input_select.${string}` }) {
  const helpers = useHass((s) => s.helpers);
  const entityState = useHass((s) => s.entities[entityId]?.state as string | undefined);
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const isUnavailable = !entityState || entityState === "unavailable" || entityState === "unknown";

  const handleAllOff = useCallback(async () => {
    if (isUnavailable || busy) return;
    setBusy(true);
    try {
      helpers.callService({
        domain: "input_select",
        service: "select_option",
        serviceData: { option: "aus" },
        target: { entity_id: entityId },
      });
    } catch (err: unknown) {
      console.error("Failed to set all off:", err);
    } finally {
      setBusy(false);
    }
  }, [isUnavailable, busy, helpers, entityId]);

  return (
    <button
      type="button"
      onClick={handleAllOff}
      disabled={busy || isUnavailable}
      title={t("quickToggle.allOff")}
      aria-label={t("quickToggle.allOff")}
      className={cn(
        "p-1 rounded transition-colors",
        "text-slate-400 hover:text-red-400 hover:bg-slate-800",
        "disabled:opacity-50 disabled:cursor-not-allowed"
      )}
    >
      <Icon path={mdiLightbulbOff} size={0.75} />
    </button>
  );
}

export function SmarthomePage() {
  const { t } = useTranslation();
  const { data: dashConfig, loading, error } = useDashboardConfig();
  const { state: timerState } = useTimerSocket();
  const { state: vacuumRoutineState } = useVacuumRoutineSocket();
  const rooms = dashConfig?.rooms ?? [];
  const quickToggleMap = buildQuickToggleMap(dashConfig?.quickToggles);
  const roomLayout = buildRoomLayout(rooms);
  const globalEntity = dashConfig?.quickToggles?.globalEntity;
  const roborockEntityId = dashConfig?.roborock?.entityId;
  const roborockState = useHass((s) =>
    roborockEntityId ? (s.entities[roborockEntityId]?.state as string | undefined) : undefined
  );

  const isTimerActive = timerState?.running === true || timerState?.alerting === true;
  const isVacuumActive = isVacuumActiveState(roborockState);
  const isVacuumRoutineActive =
    vacuumRoutineState?.executionState &&
    vacuumRoutineState.executionState !== "idle";

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Page header */}
      <h2 className="text-2xl font-bold text-slate-100">
        {t("nav.dashboard")}
      </h2>

      {/* Timer */}
      <CollapsiblePanel
        panelKey="timer"
        icon={mdiTimer}
        title={t("timer.title")}
        defaultCollapsed
        forceExpanded={isTimerActive}
      >
        <TimerCard />
      </CollapsiblePanel>
      
      {/* Quick Access + Vacuum — 2-col on desktop */}
      {HA_CONFIGURED && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <CardErrorBoundary>
            <CollapsiblePanel
              panelKey="quick-access"
              icon={mdiLightbulbGroup}
              title={t("quickToggle.title")}
              headerActions={
                globalEntity ? <AllOffButton entityId={globalEntity} /> : undefined
              }
            >
              {dashConfig ? <QuickAccessPanel config={dashConfig} /> : null}
            </CollapsiblePanel>
          </CardErrorBoundary>

          <CardErrorBoundary>
            <CollapsiblePanel
              panelKey="roborock"
              icon={mdiRobotVacuum}
              title={t("roborock.title")}
              forceExpanded={isVacuumActive}
            >
              <RoborockQuickPanel />
            </CollapsiblePanel>
          </CardErrorBoundary>
        </div>
      )}

      {/* Vacuum routines panel */}
      {HA_CONFIGURED && dashConfig?.vacuum && (
        <CardErrorBoundary>
          <CollapsiblePanel
            panelKey="vacuum-routines"
            icon={mdiRobotVacuum}
            title={t("vacuum.routines.title")}
            defaultCollapsed
            forceExpanded={isVacuumRoutineActive}
          >
            <VacuumRoutinePanel />
          </CollapsiblePanel>
        </CardErrorBoundary>
      )}

      {/* HA Automations — control plane for automations living in HA */}
      {HA_CONFIGURED && dashConfig?.automations && (
        <CardErrorBoundary>
          <AutomationsPanel />
        </CardErrorBoundary>
      )}

      {/* Rooms section */}
      {HA_CONFIGURED && !loading && !error && rooms.length === 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900 px-6 py-8 text-center space-y-2">
          <p className="text-slate-300 font-medium">{t("rooms.noRooms")}</p>
          <p className="text-sm text-slate-500">{t("rooms.noRoomsHint")}</p>
        </div>
      )}

      {HA_CONFIGURED && error && (
        <div className="rounded-lg border border-red-900/50 bg-slate-900 px-6 py-4">
          <p className="text-sm text-red-400">
            {t("entity.failedToLoad")}: {error}
          </p>
        </div>
      )}

      {HA_CONFIGURED && rooms.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-3">
            {t("rooms.title")}
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {roomLayout.map(({ room, spanFull }) => (
              <div
                key={room.id}
                className={cn(spanFull && "md:col-span-2")}
              >
                <CardErrorBoundary>
                  <CollapsiblePanel
                    panelKey={`room-${room.id}`}
                    icon={resolveDashboardIcon(room.icon)}
                    title={room.name}
                  >
                    <CompactRoomCard
                      room={room}
                      quickToggleEntity={quickToggleMap.get(room.id)}
                    />
                  </CollapsiblePanel>
                </CardErrorBoundary>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
