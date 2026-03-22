import { useEntity } from "@hakit/core";
import { mdiPower } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { Card } from "@/components/ui/card";
import { haIconToMdiPath } from "@/lib/ha/icons";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useCallback, useState } from "react";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { useIsMobile } from "@/hooks/useIsMobile";

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

  const isUnavailable =
    !entity ||
    entity.state === "unavailable" ||
    entity.state === "unknown";

  const isOn = entity?.state === "on";
  const friendlyName =
    entity?.attributes.friendly_name ?? entityId.split(".")[1] ?? entityId;
  const iconPath =
    haIconToMdiPath(entity?.attributes.icon ?? "") ?? mdiPower;

  const handleToggle = useCallback(async () => {
    if (isUnavailable || !entity) return;
    try {
      await entity.service.toggle();
    } catch (err: unknown) {
      console.error("Failed to toggle switch:", entityId, err);
    }
  }, [isUnavailable, entity, entityId]);

  const handleCardClick = useCallback(() => {
    if (isMobile) {
      setSheetOpen(true);
    } else {
      handleToggle();
    }
  }, [isMobile, handleToggle]);

  const handleSheetToggle = useCallback(() => {
    handleToggle();
    setSheetOpen(false);
  }, [handleToggle]);

  return (
    <>
      <Card
        role="button"
        tabIndex={0}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick();
          }
        }}
        style={{ height: 140 }}
        className={cn(
          "cursor-pointer select-none transition-colors duration-300",
          isOn && "bg-amber-400/5 border-amber-900/50",
          isUnavailable && "opacity-50 pointer-events-none"
        )}
      >
        {/* On glow */}
        {isOn && (
          <div className="absolute inset-x-0 bottom-0 h-full bg-gradient-to-t from-amber-400/10 to-transparent rounded-lg transition-opacity duration-300" />
        )}

        <div className="relative z-10 h-full flex flex-col justify-between p-3">
          {/* Icon centered */}
          <div className="flex-1 flex items-center justify-center">
            <Icon
              path={iconPath}
              size={1.5}
              className={cn(
                "transition-colors duration-300",
                isOn ? "text-amber-400" : "text-slate-500"
              )}
            />
          </div>

          {/* Name at bottom */}
          <div className="flex items-end justify-between">
            <span
              className={cn(
                "text-sm font-medium truncate",
                isOn ? "text-slate-100" : "text-slate-400"
              )}
              title={friendlyName}
            >
              {friendlyName}
            </span>
            <span
              className={cn(
                "text-xs shrink-0 ml-2",
                isOn ? "text-amber-400" : "text-slate-500"
              )}
            >
              {isOn ? t("lights.on") : t("lights.off")}
            </span>
          </div>

          {isUnavailable && (
            <p className="text-xs text-slate-500">{t("entity.unavailable")}</p>
          )}
        </div>
      </Card>

      {/* Mobile bottom sheet for safe toggling */}
      {isMobile && (
        <BottomSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          title={friendlyName}
        >
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Icon
                  path={iconPath}
                  size={1.2}
                  className={isOn ? "text-amber-400" : "text-slate-500"}
                />
                <span className="text-sm text-slate-300">
                  {isOn ? t("lights.on") : t("lights.off")}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={handleSheetToggle}
              className={cn(
                "w-full py-3 rounded-lg text-sm font-semibold transition-colors",
                isOn
                  ? "bg-slate-700 text-slate-100 hover:bg-slate-600"
                  : "bg-amber-400 text-slate-950 hover:bg-amber-300"
              )}
            >
              {isOn ? t("lights.off") : t("lights.on")}
            </button>
          </div>
        </BottomSheet>
      )}
    </>
  );
}
