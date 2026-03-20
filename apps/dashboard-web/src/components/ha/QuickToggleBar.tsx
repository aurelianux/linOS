import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { QuickToggle } from "./QuickToggle";
import { CardErrorBoundary } from "@/components/common/CardErrorBoundary";
import type { QuickToggleConfig } from "@/lib/api/types";

interface QuickToggleBarProps {
  roomFilter?: string[];
  showGlobal?: boolean;
}

export function QuickToggleBar({
  roomFilter,
  showGlobal = true,
}: QuickToggleBarProps) {
  const { data: config } = useDashboardConfig();
  const { t } = useTranslation();

  const quickToggles = config?.quickToggles as QuickToggleConfig | undefined;
  if (!quickToggles) return null;

  const rooms = roomFilter
    ? quickToggles.rooms.filter((r) => roomFilter.includes(r.roomId))
    : quickToggles.rooms;

  const roomNameMap = new Map(
    (config?.rooms ?? []).map((r) => [r.id, r.name])
  );

  return (
    <div className="space-y-2">
      <h3 className="text-sm font-medium text-slate-400">
        {t("quickToggle.title")}
      </h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
        {showGlobal && (
          <CardErrorBoundary entityId={quickToggles.globalEntity}>
            <QuickToggle
              entityId={quickToggles.globalEntity}
              label={t("quickToggle.apartment")}
              modes={quickToggles.modes}
            />
          </CardErrorBoundary>
        )}
        {rooms.map((room) => (
          <CardErrorBoundary key={room.roomId} entityId={room.entity}>
            <QuickToggle
              entityId={room.entity}
              label={roomNameMap.get(room.roomId) ?? room.roomId}
              modes={quickToggles.modes}
            />
          </CardErrorBoundary>
        ))}
      </div>
    </div>
  );
}
