import { useEntity } from "@hakit/core";
import { mdiLightbulb } from "@mdi/js";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { haIconToMdiPath } from "@/lib/ha/icons";
import Icon from "@mdi/react";

interface LightCardProps {
  entityId: `light.${string}`;
}

/**
 * Smart-Home card for light entities.
 *
 * Features:
 * - Real-time state via useEntity()
 * - Toggle (Switch) calls entity.service.toggle()
 * - Brightness slider (only shown when light is on) calls entity.service.turnOn({ serviceData: { brightness } })
 * - Amber glow background when light is on
 * - Grayed out + controls disabled when entity is unavailable/unknown
 */
export function LightCard({ entityId }: LightCardProps) {
  const entity = useEntity(entityId, { returnNullIfNotFound: true });

  const isUnavailable =
    !entity ||
    entity.state === "unavailable" ||
    entity.state === "unknown";

  const isOn = entity?.state === "on";

  // HA brightness is 0-255; show as 0-255 in the slider
  const brightness = entity?.attributes.brightness ?? 0;

  const friendlyName =
    entity?.attributes.friendly_name ?? entityId.split(".")[1] ?? entityId;

  const iconPath =
    haIconToMdiPath(entity?.attributes.icon ?? "") ?? mdiLightbulb;

  const handleToggle = () => {
    if (isUnavailable) return;
    entity.service.toggle();
  };

  const handleBrightness = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isUnavailable || !isOn) return;
    entity.service.turnOn({ serviceData: { brightness: Number(e.target.value) } });
  };

  return (
    <Card
      className={[
        "transition-colors duration-300",
        isOn ? "bg-amber-400/5 border-amber-900/50" : "",
        isUnavailable ? "opacity-50" : "",
      ]
        .filter(Boolean)
        .join(" ")}
    >
      <CardContent className="p-4 space-y-3">
        {/* Header row: icon + name + toggle */}
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

        {/* Brightness slider – only shown when light is on */}
        {isOn && !isUnavailable && (
          <div className="space-y-1">
            <Slider
              min={1}
              max={255}
              step={1}
              value={brightness}
              onChange={handleBrightness}
              aria-label={`Brightness for ${friendlyName}`}
            />
            <p className="text-xs text-slate-500 text-right">
              {Math.round((brightness / 255) * 100)}%
            </p>
          </div>
        )}

        {/* Unavailable state */}
        {isUnavailable && (
          <p className="text-xs text-slate-500">Nicht verfügbar</p>
        )}
      </CardContent>
    </Card>
  );
}
