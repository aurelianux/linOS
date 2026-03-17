import { HA_CONFIGURED } from "@/lib/ha/config";
import { HaStatusCard } from "@/components/ha/HaStatusCard";
import { DashboardRoomCard } from "@/components/ha/DashboardRoomCard";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";

/**
 * Rooms page – spatial view of the smart home.
 *
 * Rooms are driven by GET /dashboard/config from dashboard-api.
 * Each room card shows a light group toggle and scene buttons.
 */
export function RoomsPage() {
  const { t } = useTranslation();
  const { data: dashConfig, loading, error } = useDashboardConfig();
  const rooms = dashConfig?.rooms ?? [];
  const hasRooms = rooms.length > 0;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-100 mb-2">{t("rooms.title")}</h2>
        <p className="text-slate-400">{t("rooms.subtitle")}</p>
      </div>

      {!HA_CONFIGURED && <HaStatusCard haConfigured={false} />}

      {HA_CONFIGURED && !loading && !error && !hasRooms && (
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

      {HA_CONFIGURED && hasRooms && (
        <div className="space-y-4">
          {rooms.map((room) => (
            <DashboardRoomCard key={room.id} room={room} />
          ))}
        </div>
      )}
    </div>
  );
}
