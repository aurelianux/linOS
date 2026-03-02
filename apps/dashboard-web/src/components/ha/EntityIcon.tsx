import Icon from "@mdi/react";
import { mdiDevices } from "@mdi/js";
import { haIconToMdiPath } from "@/lib/ha/icons";

interface EntityIconProps {
  entity: { attributes: { icon?: string } };
  size?: number;
  className?: string;
}

export function EntityIcon({ entity, size = 1, className }: EntityIconProps) {
  const path = haIconToMdiPath(entity.attributes.icon ?? "") ?? mdiDevices;
  return <Icon path={path} size={size} className={className} />;
}
