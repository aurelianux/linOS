import { useEntity } from "@hakit/core";
import Icon from "@mdi/react";
import { cn } from "@/lib/utils";
import { resolveDashboardIcon } from "@/lib/ha/dashboardIcons";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { DashboardQuickAction } from "@/lib/api/types";

interface QuickActionButtonProps {
  action: DashboardQuickAction;
}

function QuickActionButton({ action }: QuickActionButtonProps) {
  const entity = useEntity(action.entityId, { returnNullIfNotFound: true });
  const { t } = useTranslation();
  const isUnavailable = !entity || entity.state === "unavailable" || entity.state === "unknown";
  const iconPath = resolveDashboardIcon(action.icon);

  const handleRun = () => {
    if (isUnavailable || !entity) return;
    entity.service.turnOn().catch((err: unknown) => {
      console.error("Failed to run quick action:", action.entityId, err);
    });
  };

  return (
    <button
      onClick={handleRun}
      disabled={isUnavailable}
      title={isUnavailable ? t("entity.unavailable") : action.label}
      className={cn(
        "flex flex-col items-center gap-1.5 px-4 py-3 rounded-xl",
        "border border-slate-800 bg-slate-900 text-slate-300",
        "hover:bg-slate-800 hover:border-slate-700 hover:text-slate-100",
        "transition-colors duration-200",
        "disabled:opacity-40 disabled:cursor-not-allowed",
        "min-w-[72px]"
      )}
    >
      <Icon path={iconPath} size={1.1} />
      <span className="text-xs font-medium">{action.label}</span>
    </button>
  );
}

interface QuickActionBarProps {
  actions: DashboardQuickAction[];
}

/**
 * Horizontal row of mode-switching script buttons (Home / Away / Sleep / Awake).
 * Each button fires the corresponding HA script entity when clicked.
 */
export function QuickActionBar({ actions }: QuickActionBarProps) {
  if (actions.length === 0) return null;

  return (
    <div className="flex flex-wrap gap-3">
      {actions.map((action) => (
        <QuickActionButton key={action.id} action={action} />
      ))}
    </div>
  );
}
