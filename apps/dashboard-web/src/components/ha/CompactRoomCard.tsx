import { CardErrorBoundary } from "@/components/common/CardErrorBoundary";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import type { DashboardRoom, QuickToggleConfig } from "@/lib/api/types";
import { useTranslation } from "@/lib/i18n/useTranslation";
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

/**
 * Room content — entity cards + air quality + quick toggle.
 * Intended to be wrapped in a CollapsiblePanel by the parent page.
 */
export function CompactRoomCard({
  room,
  quickToggleEntity,
}: CompactRoomCardProps) {
  const { t } = useTranslation();
  const { data: config } = useDashboardConfig();
  const quickToggles = config?.quickToggles as QuickToggleConfig | undefined;

  const airQualityIds = getAirQualityEntityIds(room);
  const filteredEntities = room.entities.filter(
    (id) => !airQualityIds.has(id)
  );
  const hasContent = filteredEntities.length > 0 || !!quickToggleEntity;

  if (!hasContent) {
    return <p className="text-xs text-slate-500">{t("rooms.noEntities")}</p>;
  }

  return (
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

      {/* Entity cards in responsive grid */}
      {filteredEntities.length > 0 && (
        <div
          className="grid gap-2"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))" }}
        >
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
  );
}

/**
 * Determine if a room is "large" (should span full width on desktop).
 * Large rooms have >3 entities or include airQuality data.
 */
export function isLargeRoom(room: DashboardRoom): boolean {
  const airQualityIds = getAirQualityEntityIds(room);
  const filteredCount = room.entities.filter(
    (id) => !airQualityIds.has(id)
  ).length;
  return filteredCount > 3;
}
