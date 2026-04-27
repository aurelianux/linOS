import { useEntity } from "@hakit/core";
import { mdiPower } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import { haIconToMdiPath } from "@/lib/ha/icons";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useCallback, useState } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import { SwitchCardSheet } from "./SwitchCard.helpers";

type SwitchDomain =
  | `switch.${string}`
  | `input_boolean.${string}`
  | `fan.${string}`
  | `automation.${string}`;

interface SwitchCardProps {
  entityId: SwitchDomain;
}

export function SwitchCard({ entityId }: SwitchCardProps) {
  const entity = useEntity(entityId, { returnNullIfNotFound: true });
  const { t } = useTranslation();
  const isMobile = useIsMobile();
  const [sheetOpen, setSheetOpen] = useState(false);

  const isUnavailable = !entity || entity.state === "unavailable" || entity.state === "unknown";
  const isOn = entity?.state === "on";
  const friendlyName = entity?.attributes.friendly_name ?? entityId.split(".")[1] ?? entityId;
  const iconPath = haIconToMdiPath(entity?.attributes.icon ?? "") ?? mdiPower;

  const handleToggle = useCallback(async () => {
    if (isUnavailable || !entity) return;
    try { await entity.service.toggle(); }
    catch (err: unknown) { console.error("Failed to toggle switch:", entityId, err); }
  }, [isUnavailable, entity, entityId]);

  const handleCardClick = useCallback(() => {
    if (isMobile) setSheetOpen(true);
    else handleToggle();
  }, [isMobile, handleToggle]);

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); handleCardClick(); } }}
        style={{ height: 140 }}
        className={cn(
          "cursor-pointer select-none transition-colors duration-300",
          isOn && "bg-amber-400/5 border-amber-900/50",
          isUnavailable && "opacity-50 pointer-events-none"
        )}
      >
        {isOn && (
          <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-amber-400/10 to-transparent rounded-lg transition-opacity duration-300" />
        )}
        <div className="relative z-10 h-full flex flex-col justify-between p-3">
          <div className="flex-1 flex items-center justify-center">
            <Icon path={iconPath} size={1.5} className={cn("transition-colors duration-300", isOn ? "text-amber-400" : "text-slate-500")} />
          </div>
          <div className="flex items-end justify-between">
            <span className={cn("text-sm font-medium truncate", isOn ? "text-slate-100" : "text-slate-400")} title={friendlyName}>
              {friendlyName}
            </span>
            <span className={cn("text-xs shrink-0 ml-2", isOn ? "text-amber-400" : "text-slate-500")}>
              {isOn ? t("lights.on") : t("lights.off")}
            </span>
          </div>
          {isUnavailable && <p className="text-xs text-slate-500">{t("entity.unavailable")}</p>}
        </div>
      </Card>
      {isMobile && (
        <SwitchCardSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={friendlyName}
          isOn={isOn}
          iconPath={iconPath}
          onToggle={() => { handleToggle(); setSheetOpen(false); }}
          onLabel={t("lights.on")}
          offLabel={t("lights.off")}
        />
      )}
    </>
  );
}
