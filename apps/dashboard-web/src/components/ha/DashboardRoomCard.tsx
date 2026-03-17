import { useState } from "react";
import Icon from "@mdi/react";
import { mdiChevronDown, mdiChevronUp } from "@mdi/js";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { resolveDashboardIcon } from "@/lib/ha/dashboardIcons";
import { getCardForDomain } from "./domainCards";
import { CardErrorBoundary } from "@/components/common/CardErrorBoundary";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { DashboardRoom } from "@/lib/api/types";

interface DashboardRoomCardProps {
  room: DashboardRoom;
}

/**
 * Room card driven by dashboard config.
 * Renders entity cards for all entities assigned to the room.
 */
export function DashboardRoomCard({ room }: DashboardRoomCardProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(true);
  const iconPath = resolveDashboardIcon(room.icon);
  const hasEntities = room.entities.length > 0;

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardContent className="p-4">
        <button
          onClick={() => setExpanded((prev) => !prev)}
          disabled={!hasEntities}
          className={cn(
            "w-full flex items-center justify-between gap-2",
            hasEntities && "cursor-pointer"
          )}
        >
          <div className="flex items-center gap-3">
            <Icon path={iconPath} size={1} className="text-slate-400 shrink-0" />
            <span className="text-base font-semibold text-slate-100">{room.name}</span>
          </div>
          {hasEntities && (
            <Icon
              path={expanded ? mdiChevronUp : mdiChevronDown}
              size={0.9}
              className="text-slate-500 shrink-0"
            />
          )}
        </button>

        {expanded && hasEntities && (
          <div className="mt-3 pt-3 border-t border-slate-800">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {room.entities.map((entityId) => {
                const domain = entityId.split(".")[0] ?? "";
                const EntityCard = getCardForDomain(domain);
                return (
                  <CardErrorBoundary key={entityId} entityId={entityId}>
                    <EntityCard entityId={entityId} />
                  </CardErrorBoundary>
                );
              })}
            </div>
          </div>
        )}

        {!hasEntities && (
          <p className="text-xs text-slate-500 mt-2">{t("rooms.noEntities")}</p>
        )}
      </CardContent>
    </Card>
  );
}
