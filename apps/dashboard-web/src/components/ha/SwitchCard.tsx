import { useEntity } from "@hakit/core";
import { mdiPower } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { haIconToMdiPath } from "@/lib/ha/icons";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";

type SwitchDomain =
  | `switch.${string}`
  | `input_boolean.${string}`
  | `fan.${string}`
  | `automation.${string}`;

interface SwitchCardProps {
  entityId: SwitchDomain;
}

/**
 * Smart-Home card for toggleable entities.
 * Supports: switch, input_boolean, fan, automation domains.
 *
 * Features:
 * - Real-time state via useEntity()
 * - Toggle via entity.service.toggle()
 * - Grayed out + controls disabled when entity is unavailable/unknown
 */
export function SwitchCard({ entityId }: SwitchCardProps) {
  const entity = useEntity(entityId, { returnNullIfNotFound: true });
  const { t } = useTranslation();

  const isUnavailable =
    !entity ||
    entity.state === "unavailable" ||
    entity.state === "unknown";

  const isOn = entity?.state === "on";

  const friendlyName =
    entity?.attributes.friendly_name ?? entityId.split(".")[1] ?? entityId;

  const iconPath =
    haIconToMdiPath(entity?.attributes.icon ?? "") ?? mdiPower;

  const handleToggle = () => {
    if (isUnavailable || !entity) return;
    entity.service.toggle().catch((err: unknown) => {
      console.error("Failed to toggle switch:", entityId, err);
    });
  };

  return (
    <Card className={cn(isUnavailable && "opacity-50")}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Icon
              path={iconPath}
              size={1}
              className={isOn ? "text-amber-400" : "text-slate-400"}
            />
            <span
              className="text-sm font-medium text-slate-200 truncate"
              title={friendlyName}
            >
              {friendlyName}
            </span>
          </div>
          <Switch
            checked={isOn}
            onChange={handleToggle}
            disabled={isUnavailable}
            aria-label={`Toggle ${friendlyName}`}
          />
        </div>
        {isUnavailable && (
          <p className="text-xs text-slate-500 mt-2">{t("entity.unavailable")}</p>
        )}
      </CardContent>
    </Card>
  );
}
