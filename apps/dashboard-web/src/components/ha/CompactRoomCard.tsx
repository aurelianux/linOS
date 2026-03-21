import { CardErrorBoundary } from "@/components/common/CardErrorBoundary";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import type { DashboardRoom, QuickToggleConfig } from "@/lib/api/types";
import { resolveDashboardIcon } from "@/lib/ha/dashboardIcons";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { AirQualitySensorCard } from "./AirQualitySensorCard";
import { getCardForDomain } from "./domainCards";
import { QuickToggle } from "./QuickToggle";

interface CompactRoomCardProps {
  room: DashboardRoom;
  quickToggleEntity?: `input_select.${string}`;
}

function getAirQualityEntityIds(room: DashboardRoom): Set<string> {
  if (!room.airQuality) return new Set();
  return new Set([
    room.airQuality.temperature,
    room.airQuality.humidity,
    ...room.airQuality.secondary,
  ]);
}

export function CompactRoomCard({
  room,
  quickToggleEntity,
}: CompactRoomCardProps) {
  const { t } = useTranslation();
  const { data: config } = useDashboardConfig();
  const iconPath = resolveDashboardIcon(room.icon);
  const quickToggles = config?.quickToggles as QuickToggleConfig | undefined;

  const airQualityIds = getAirQualityEntityIds(room);
  const filteredEntities = room.entities.filter(
    (id) => !airQualityIds.has(id)
  );
  const hasContent =
    filteredEntities.length > 0 || !!room.airQuality || !!quickToggleEntity;

  return (
    <Card className="border-slate-800 bg-slate-900 h-full">
      <CardContent className="p-3">
        {/* Room header */}
        <div className="flex items-center gap-2 mb-2">
          <Icon
            path={iconPath}
            size={0.8}
            className="text-slate-400 shrink-0"
          />
          <span className="text-sm font-semibold text-slate-100">
            {room.name}
          </span>
        </div>

        {hasContent && (
          <div className="space-y-2">
            {/* Quick toggle for this room */}
            {quickToggleEntity && (
              <CardErrorBoundary entityId={quickToggleEntity}>
                <QuickToggle
                  entityId={quickToggleEntity}
                  label={room.name}
                  modes={quickToggles?.modes}
                />
              </CardErrorBoundary>
            )}

            {/* Composite air quality / sensor card */}
            {room.airQuality && (
              <CardErrorBoundary entityId={room.airQuality.temperature}>
                <AirQualitySensorCard config={room.airQuality} />
              </CardErrorBoundary>
            )}

            {/* Entity cards in compact grid */}
            {filteredEntities.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-2">
                {filteredEntities.map((entityId) => {
                  const domain = entityId.split(".")[0] ?? "";
                  const EntityCard = getCardForDomain(domain);
                  return (
                    <CardErrorBoundary key={entityId} entityId={entityId}>
                      <EntityCard entityId={entityId} />
                    </CardErrorBoundary>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {!hasContent && (
          <p className="text-xs text-slate-500">{t("rooms.noEntities")}</p>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Determine if a room is "large" (should span full width on desktop).
 * Large rooms have >3 entities or include airQuality data.
 */
export function isLargeRoom(room: DashboardRoom): boolean {
  const airQualityIds = room.airQuality
    ? new Set([
        room.airQuality.temperature,
        room.airQuality.humidity,
        ...room.airQuality.secondary,
      ])
    : new Set<string>();
  const filteredCount = room.entities.filter(
    (id) => !airQualityIds.has(id)
  ).length;
  return filteredCount > 3 || (!!room.airQuality && filteredCount > 1);
}
