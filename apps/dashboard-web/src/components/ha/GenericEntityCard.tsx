import { useEntity } from "@hakit/core";
import { mdiDevices } from "@mdi/js";
import Icon from "@mdi/react";
import { Card, CardContent } from "@/components/ui/card";
import { haIconToMdiPath } from "@/lib/ha/icons";

interface GenericEntityCardProps {
  entityId: string;
}

/**
 * Read-only fallback card for HA entity domains not supported by a
 * dedicated card (LightCard / SwitchCard / SensorCard).
 * Displays the entity name and its current state as plain text.
 */
export function GenericEntityCard({ entityId }: GenericEntityCardProps) {
  const entity = useEntity(entityId as `${string}.${string}`, {
    returnNullIfNotFound: true,
  });

  const isUnavailable =
    !entity ||
    entity.state === "unavailable" ||
    entity.state === "unknown";

  const friendlyName =
    entity?.attributes.friendly_name ?? entityId.split(".")[1] ?? entityId;

  const iconPath =
    haIconToMdiPath(entity?.attributes.icon ?? "") ?? mdiDevices;

  const value = isUnavailable ? "–" : entity.state;

  return (
    <Card className={isUnavailable ? "opacity-50" : ""}>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Icon path={iconPath} size={1} className="text-slate-400 shrink-0" />
          <span
            className="text-sm font-medium text-slate-400 truncate"
            title={friendlyName}
          >
            {friendlyName}
          </span>
        </div>
        <p className="text-sm text-slate-300">{value}</p>
      </CardContent>
    </Card>
  );
}
