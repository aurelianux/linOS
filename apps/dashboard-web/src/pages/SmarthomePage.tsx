import { CardErrorBoundary } from "@/components/common/CardErrorBoundary";
import { CompactRoomCard, isLargeRoom } from "@/components/ha/CompactRoomCard";
import { QuickToggleBar } from "@/components/ha/QuickToggleBar";
import { RoborockQuickPanel } from "@/components/panels/RoborockQuickPanel";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import type { DashboardRoom, QuickToggleConfig } from "@/lib/api/types";
import { HA_CONFIGURED } from "@/lib/ha/config";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { cn } from "@/lib/utils";

function buildQuickToggleMap(
  quickToggles: QuickToggleConfig | undefined
): Map<string, `input_select.${string}`> {
  if (!quickToggles) return new Map();
  return new Map(
    quickToggles.rooms.map((r) => [r.roomId, r.entity])
  );
}

/**
 * Build a flat list of room entries with layout hints.
 * Large rooms get full width, small rooms share a row when possible.
 */
function buildRoomLayout(rooms: DashboardRoom[]): Array<{
  room: DashboardRoom;
  spanFull: boolean;
}> {
  return rooms.map((room) => ({
    room,
    spanFull: isLargeRoom(room),
  }));
}

export function SmarthomePage() {
  const { t } = useTranslation();
  const { data: dashConfig, loading, error } = useDashboardConfig();
  const rooms = dashConfig?.rooms ?? [];
  const quickToggleMap = buildQuickToggleMap(dashConfig?.quickToggles);
  const roomLayout = buildRoomLayout(rooms);

  return (
    <div className="p-4 md:p-6 space-y-5">
      {/* Page header */}
      <div>
        <h2 className="text-2xl font-bold text-slate-100">
          {t("nav.dashboard")}
        </h2>
      </div>

      {/* Quick toggles */}
      {HA_CONFIGURED && (
        <CardErrorBoundary>
          <QuickToggleBar />
        </CardErrorBoundary>
      )}

      {/* Vacuum */}
      {HA_CONFIGURED && (
        <CardErrorBoundary>
          <RoborockQuickPanel />
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {roomLayout.map(({ room, spanFull }) => (
              <div
                key={room.id}
                className={cn(spanFull && "md:col-span-2")}
              >
                <CompactRoomCard
                  room={room}
                  quickToggleEntity={quickToggleMap.get(room.id)}
                />
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
