import { useState } from "react";
import { useEntity } from "@hakit/core";
import Icon from "@mdi/react";
import { mdiChevronDown, mdiChevronUp, mdiLightbulbGroup } from "@mdi/js";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { resolveDashboardIcon } from "@/lib/ha/dashboardIcons";
import { SceneButton } from "./SceneButton";
import { getCardForDomain } from "./domainCards";
import { CardErrorBoundary } from "@/components/common/CardErrorBoundary";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { DashboardRoom } from "@/lib/api/types";

interface LightGroupToggleProps {
  entityId: string;
}

function LightGroupToggle({ entityId }: LightGroupToggleProps) {
  const entity = useEntity(entityId, { returnNullIfNotFound: true });
  const { t } = useTranslation();
  const isUnavailable = !entity || entity.state === "unavailable" || entity.state === "unknown";
  const isOn = entity?.state === "on";

  const handleToggle = () => {
    if (isUnavailable || !entity) return;
    const call = isOn ? entity.service.turnOff() : entity.service.turnOn();
    call.catch((err: unknown) => {
      console.error("Failed to toggle light group:", entityId, err);
    });
  };

  return (
    <div className="flex items-center justify-between gap-2 py-1">
      <div className="flex items-center gap-2 text-slate-400">
        <Icon
          path={mdiLightbulbGroup}
          size={0.85}
          className={isOn ? "text-amber-400" : "text-slate-500"}
        />
        <span className="text-sm text-slate-400">
          {isUnavailable ? t("entity.unavailable") : isOn ? t("lights.on") : t("lights.off")}
        </span>
      </div>
      <Switch
        checked={isOn}
        onChange={handleToggle}
        disabled={isUnavailable}
        aria-label={`Toggle lights for ${entityId}`}
      />
    </div>
  );
}

interface DashboardRoomCardProps {
  room: DashboardRoom;
}

/**
 * Room card driven by dashboard config.
 * Shows a collapsible card with light group toggle + scene buttons.
 */
export function DashboardRoomCard({ room }: DashboardRoomCardProps) {
  const [expanded, setExpanded] = useState(true);
  const iconPath = resolveDashboardIcon(room.icon);
  const roomEntities = room.entities ?? [];

  const hasContent = !!room.lightGroupId || room.scenes.length > 0 || roomEntities.length > 0;

  return (
    <Card className="border-slate-800 bg-slate-900">
      <CardContent className="p-4">
        {/* Header */}
        <button
          onClick={() => setExpanded((prev) => !prev)}
          disabled={!hasContent}
          className={cn(
            "w-full flex items-center justify-between gap-2",
            hasContent && "cursor-pointer"
          )}
        >
          <div className="flex items-center gap-3">
            <Icon path={iconPath} size={1} className="text-slate-400 shrink-0" />
            <span className="text-base font-semibold text-slate-100">{room.name}</span>
          </div>
          {hasContent && (
            <Icon
              path={expanded ? mdiChevronUp : mdiChevronDown}
              size={0.9}
              className="text-slate-500 shrink-0"
            />
          )}
        </button>

        {/* Collapsible body */}
        {expanded && hasContent && (
          <div className="mt-3 space-y-3 pt-3 border-t border-slate-800">
            {room.lightGroupId && (
              <LightGroupToggle entityId={room.lightGroupId} />
            )}
            {room.scenes.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {room.scenes.map((scene) => (
                  <SceneButton key={scene.id} scene={scene} />
                ))}
              </div>
            )}
            {roomEntities.length > 0 && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {roomEntities.map((entityId) => {
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
      </CardContent>
    </Card>
  );
}
