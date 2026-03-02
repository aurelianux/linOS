import { useEntity } from "@hakit/core";
import { mdiThermometer } from "@mdi/js";
import Icon from "@mdi/react";
import { Card, CardContent } from "@/components/ui/card";
import { haIconToMdiPath } from "@/lib/ha/icons";

interface SensorCardProps {
  entityId: `sensor.${string}`;
}

/**
 * Read-only card for sensor entities.
 * Displays the entity's current value and unit of measurement.
 *
 * Features:
 * - Real-time state via useEntity()
 * - Shows value + unit_of_measurement
 * - EntityIcon from HA icon attribute
 * - Shows "–" when entity is unavailable/unknown
 */
export function SensorCard({ entityId }: SensorCardProps) {
  const entity = useEntity(entityId, { returnNullIfNotFound: true });

  const isUnavailable =
    !entity ||
    entity.state === "unavailable" ||
    entity.state === "unknown";

  const friendlyName =
    entity?.attributes.friendly_name ?? entityId.split(".")[1] ?? entityId;

  const iconPath =
    haIconToMdiPath(entity?.attributes.icon ?? "") ?? mdiThermometer;

  const unit = entity?.attributes.unit_of_measurement ?? "";
  const value = isUnavailable ? "–" : entity.state;

  return (
    <Card>
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <Icon path={iconPath} size={1} className="text-sky-400 shrink-0" />
          <span
            className="text-sm font-medium text-slate-400 truncate"
            title={friendlyName}
          >
            {friendlyName}
          </span>
        </div>
        <p className="text-2xl font-semibold text-slate-100">
          {value}
          {!isUnavailable && unit && (
            <span className="text-sm font-normal text-slate-400 ml-1">
              {unit}
            </span>
          )}
        </p>
      </CardContent>
    </Card>
  );
}
