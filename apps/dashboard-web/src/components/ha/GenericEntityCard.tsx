import { useEntity } from "@hakit/core";
import { mdiDevices } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import { haIconToMdiPath } from "@/lib/ha/icons";
import { cn } from "@/lib/utils";

interface GenericEntityCardProps {
  entityId: string;
}

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
    <Card
      style={{ height: 140 }}
      className={cn(isUnavailable && "opacity-50")}
    >
      <div className="relative z-10 h-full flex flex-col justify-between p-3">
        <div className="flex items-center gap-2">
          <Icon
            path={iconPath}
            size={0.8}
            className="text-slate-400 shrink-0"
          />
          <span
            className="text-sm font-medium text-slate-400 truncate"
            title={friendlyName}
          >
            {friendlyName}
          </span>
        </div>

        <div className="flex items-center justify-center">
          <span className="text-lg text-slate-300">{value}</span>
        </div>

        <div />
      </div>
    </Card>
  );
}
