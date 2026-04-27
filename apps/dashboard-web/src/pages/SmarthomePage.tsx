import { CardErrorBoundary } from "@/components/common/CardErrorBoundary";
import { CollapsiblePanel } from "@/components/common/CollapsiblePanel";
import { CompactRoomCard } from "@/components/ha/CompactRoomCard";
import { QuickAccessPanel } from "@/components/ha/QuickAccessPanel";
import { VacuumPanel } from "@/components/panels/VacuumPanel";
import { AllOffButton, buildQuickToggleRooms, buildRoomLayout } from "@/components/panels/SmarthomePage.helpers";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useVacuumRoutineSocket } from "@/hooks/useVacuumRoutineSocket";
import { HA_CONFIGURED } from "@/lib/ha/config";
import { resolveDashboardIcon } from "@/lib/ha/dashboardIcons";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { cn } from "@/lib/utils";
import { useHass } from "@hakit/core";
import { mdiLightbulbGroup, mdiRobotVacuum } from "@mdi/js";

export function SmarthomePage() {
  const { t } = useTranslation();
  const { data: dashConfig, loading, error } = useDashboardConfig();
  const { state: vacuumRoutineState } = useVacuumRoutineSocket();
  const rooms = dashConfig?.rooms ?? [];
  const quickToggleRooms = buildQuickToggleRooms(dashConfig?.quickToggles);
  const roomLayout = buildRoomLayout(rooms);
  const roborockEntityId = dashConfig?.roborock?.entityId;
  const roborockState = useHass((s) =>
    roborockEntityId ? (s.entities[roborockEntityId]?.state as string | undefined) : undefined
  );

  const isVacuumActive =
    roborockState === "cleaning" || roborockState === "paused" || roborockState === "returning" ||
    (!!vacuumRoutineState?.executionState && vacuumRoutineState.executionState !== "idle");

  return (
    <div className="p-4 md:p-6 space-y-5">
      <h2 className="text-2xl font-bold text-slate-100">{t("nav.dashboard")}</h2>

      {HA_CONFIGURED && (
        <CardErrorBoundary>
          <CollapsiblePanel panelKey="quick-access" icon={mdiLightbulbGroup} title={t("quickToggle.title")} headerActions={dashConfig?.quickToggles ? <AllOffButton /> : undefined}>
            {dashConfig ? <QuickAccessPanel config={dashConfig} /> : null}
          </CollapsiblePanel>
        </CardErrorBoundary>
      )}

      {HA_CONFIGURED && (
        <CardErrorBoundary>
          <CollapsiblePanel panelKey="vacuum" icon={mdiRobotVacuum} title={t("vacuum.title")} forceExpanded={isVacuumActive}>
            <VacuumPanel />
          </CollapsiblePanel>
        </CardErrorBoundary>
      )}

      {HA_CONFIGURED && !loading && !error && rooms.length === 0 && (
        <div className="rounded-lg border border-slate-800 bg-slate-900 px-6 py-8 text-center space-y-2">
          <p className="text-slate-300 font-medium">{t("rooms.noRooms")}</p>
          <p className="text-sm text-slate-500">{t("rooms.noRoomsHint")}</p>
        </div>
      )}

      {HA_CONFIGURED && error && (
        <div className="rounded-lg border border-red-900/50 bg-slate-900 px-6 py-4">
          <p className="text-sm text-red-400">{t("entity.failedToLoad")}: {error}</p>
        </div>
      )}

      {HA_CONFIGURED && rooms.length > 0 && (
        <div>
          <h3 className="text-sm font-medium text-slate-400 mb-3">{t("rooms.title")}</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {roomLayout.map(({ room, spanFull }) => (
              <div key={room.id} className={cn(spanFull && "md:col-span-2")}>
                <CardErrorBoundary>
                  <CollapsiblePanel panelKey={`room-${room.id}`} icon={resolveDashboardIcon(room.icon)} title={room.name} defaultCollapsed>
                    <CompactRoomCard room={room} showQuickToggle={quickToggleRooms.has(room.id)} />
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
