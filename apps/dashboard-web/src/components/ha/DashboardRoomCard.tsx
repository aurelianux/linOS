import { useState } from "react";
import { Icon } from "@/components/ui/icon";
import { mdiChevronDown, mdiChevronUp } from "@mdi/js";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { resolveDashboardIcon } from "@/lib/ha/dashboardIcons";
import { getCardForDomain } from "./domainCards";
import { CardErrorBoundary } from "@/components/common/CardErrorBoundary";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { AirQualitySensorCard } from "./AirQualitySensorCard";
import { QuickToggle } from "./QuickToggle";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import type { DashboardRoom, QuickToggleConfig } from "@/lib/api/types";

interface DashboardRoomCardProps {
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

export function DashboardRoomCard({
  room,
  quickToggleEntity,
}: DashboardRoomCardProps) {
  const { t } = useTranslation();
  const { data: config } = useDashboardConfig();
  const [expanded, setExpanded] = useState(true);
  const iconPath = resolveDashboardIcon(room.icon);
  const quickToggles = config?.quickToggles as QuickToggleConfig | undefined;

  const airQualityIds = getAirQualityEntityIds(room);
  const filteredEntities = room.entities.filter(
    (id) => !airQualityIds.has(id)
  );
  const hasContent =
    filteredEntities.length > 0 || !!room.airQuality || !!quickToggleEntity;

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardContent className="p-4">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          disabled={!hasContent}
          className={cn(
            "w-full flex items-center justify-between gap-2",
            hasContent && "cursor-pointer"
          )}
        >
          <div className="flex items-center gap-3">
            <Icon
              path={iconPath}
              size={1}
              className="text-slate-400 shrink-0"
            />
            <span className="text-base font-semibold text-slate-100">
              {room.name}
            </span>
          </div>
          {hasContent && (
            <Icon
              path={expanded ? mdiChevronUp : mdiChevronDown}
              size={0.9}
              className="text-slate-500 shrink-0"
            />
          )}
        </button>

        {expanded && hasContent && (
          <div className="mt-3 pt-3 border-t border-slate-800 space-y-3">
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

            {/* Composite air quality card */}
            {room.airQuality && (
              <CardErrorBoundary entityId={room.airQuality.temperature}>
                <AirQualitySensorCard config={room.airQuality} />
              </CardErrorBoundary>
            )}

            {/* Regular entity cards */}
            {filteredEntities.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
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
          <p className="text-xs text-slate-500 mt-2">
            {t("rooms.noEntities")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
