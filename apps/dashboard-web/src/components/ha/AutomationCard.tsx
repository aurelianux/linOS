import { useEntity } from "@hakit/core";
import { mdiRobotHappy, mdiPlay } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { haIconToMdiPath } from "@/lib/ha/icons";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useCallback, useState } from "react";

interface AutomationCardProps {
  entityId: `automation.${string}`;
}

/**
 * Formats a HA last_triggered timestamp into a human-readable relative string.
 * Returns null if the timestamp is missing or the entity was never triggered.
 */
function formatLastTriggered(
  isoString: string | undefined,
  neverLabel: string
): string {
  if (!isoString) return neverLabel;

  const date = new Date(isoString);
  if (isNaN(date.getTime())) return neverLabel;

  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);

  if (diffMin < 1) return "< 1 min";
  if (diffMin < 60) return `${diffMin} min`;

  const diffH = Math.floor(diffMin / 60);
  if (diffH < 24) return `${diffH}h`;

  const diffD = Math.floor(diffH / 24);
  return `${diffD}d`;
}

/**
 * Card for a single HA automation entity.
 *
 * Shows enable/disable toggle, last triggered time, and a manual trigger button.
 * HA is the execution engine — this card is the control plane surface.
 */
export function AutomationCard({ entityId }: AutomationCardProps) {
  const entity = useEntity(entityId, { returnNullIfNotFound: true });
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const isUnavailable =
    !entity ||
    entity.state === "unavailable" ||
    entity.state === "unknown";

  // automation.* entities: "on" = enabled, "off" = disabled
  const isEnabled = entity?.state === "on";
  const friendlyName =
    entity?.attributes.friendly_name ?? entityId.split(".")[1] ?? entityId;
  const iconPath =
    haIconToMdiPath(entity?.attributes.icon ?? "") ?? mdiRobotHappy;
  const lastTriggered = formatLastTriggered(
    entity?.attributes.last_triggered as string | undefined,
    t("automations.never")
  );

  const handleToggle = useCallback(async () => {
    if (isUnavailable || !entity || busy) return;
    setBusy(true);
    try {
      if (isEnabled) {
        await entity.service.turnOff();
      } else {
        await entity.service.turnOn();
      }
    } catch (err: unknown) {
      console.error("Failed to toggle automation:", entityId, err);
    } finally {
      setBusy(false);
    }
  }, [isUnavailable, entity, entityId, isEnabled, busy]);

  const handleTrigger = useCallback(async () => {
    if (isUnavailable || !entity || busy) return;
    setBusy(true);
    try {
      await entity.service.trigger();
    } catch (err: unknown) {
      console.error("Failed to trigger automation:", entityId, err);
    } finally {
      setBusy(false);
    }
  }, [isUnavailable, entity, entityId, busy]);

  return (
    <Card
      className={cn(
        "transition-colors duration-300",
        isUnavailable && "opacity-50",
        isEnabled && "bg-emerald-400/5 border-emerald-900/50"
      )}
    >
      {/* Subtle glow when enabled */}
      {isEnabled && (
        <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-emerald-400/8 to-transparent rounded-lg transition-opacity duration-300" />
      )}

      <div className="relative z-10 p-3 space-y-2">
        {/* Top row: icon + name + toggle */}
        <div className="flex items-center gap-2">
          <Icon
            path={iconPath}
            size={0.8}
            className={cn(
              "shrink-0 transition-colors duration-300",
              isEnabled ? "text-emerald-400" : "text-slate-500"
            )}
          />
          <span
            className={cn(
              "text-sm font-medium truncate flex-1",
              isEnabled ? "text-slate-100" : "text-slate-400"
            )}
            title={friendlyName}
          >
            {friendlyName}
          </span>
          <Switch
            checked={isEnabled}
            onChange={() => handleToggle()}
            disabled={isUnavailable || busy}
          />
        </div>

        {/* Bottom row: last triggered + trigger button */}
        <div className="flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {t("automations.lastTriggered")}: {lastTriggered}
          </span>
          <button
            type="button"
            onClick={handleTrigger}
            disabled={isUnavailable || busy || !isEnabled}
            title={t("automations.trigger")}
            aria-label={t("automations.trigger")}
            className={cn(
              "p-1 rounded transition-colors",
              "text-slate-400 hover:text-sky-400 hover:bg-slate-800",
              "disabled:opacity-50 disabled:cursor-not-allowed"
            )}
          >
            <Icon path={mdiPlay} size={0.65} />
          </button>
        </div>

        {isUnavailable && (
          <p className="text-xs text-slate-500">{t("entity.unavailable")}</p>
        )}
      </div>
    </Card>
  );
}
