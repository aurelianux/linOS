import { useEntity } from "@hakit/core";
import { mdiThermometer } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import { haIconToMdiPath } from "@/lib/ha/icons";
import { cn } from "@/lib/utils";

interface SensorCardProps {
  entityId: `sensor.${string}`;
}

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
    <Card
      style={{ height: 140 }}
      className={cn(isUnavailable && "opacity-50")}
    >
      <div className="relative z-10 h-full flex flex-col justify-between p-3">
        {/* Header: icon + name */}
        <div className="flex items-center gap-2">
          <Icon
            path={iconPath}
            size={0.8}
            className="text-sky-400 shrink-0"
          />
          <span
            className="text-sm font-medium text-slate-400 truncate"
            title={friendlyName}
          >
            {friendlyName}
          </span>
        </div>

        {/* Value centered */}
        <div className="flex items-center justify-center">
          <span className="text-3xl font-semibold text-slate-100 tabular-nums">
            {value}
            {!isUnavailable && unit && (
              <span className="text-sm font-normal text-slate-400 ml-1">
                {unit}
              </span>
            )}
          </span>
        </div>

        {/* Spacer to balance layout */}
        <div />
      </div>
    </Card>
  );
}
