import { type ReactNode } from "react";
import { mdiChevronDown, mdiRefresh } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { usePanelStore } from "@/stores/panelStore";

interface CollapsiblePanelProps {
  /** Unique key for persisting collapse state */
  panelKey: string;
  /** MDI icon path */
  icon: string;
  title: string;
  children: ReactNode;
  /** Custom action buttons rendered in the header (stop-propagation handled internally) */
  headerActions?: ReactNode;
  /** Optional refresh callback — shows refresh button + timestamp */
  onRefresh?: () => void;
  loading?: boolean;
  lastUpdated?: Date | null;
  className?: string;
}

/**
 * Unified collapsible panel wrapper.
 * All dashboard panels (quick access, vacuum, rooms, system, docker)
 * use this for consistent look: icon + title + collapse toggle.
 * Collapse state persisted via panelStore.
 */
export function CollapsiblePanel({
  panelKey,
  icon,
  title,
  children,
  headerActions,
  onRefresh,
  loading = false,
  lastUpdated,
  className,
}: CollapsiblePanelProps) {
  const { t } = useTranslation();
  const collapsed = usePanelStore((s) => s.isCollapsed(panelKey));
  const toggle = usePanelStore((s) => s.toggle);

  return (
    <div
      className={cn(
        "rounded-lg border border-slate-800 bg-slate-900 flex flex-col",
        className
      )}
    >
      {/* Header — always visible, click to toggle */}
      <button
        type="button"
        onClick={() => toggle(panelKey)}
        className="flex items-center gap-2 px-4 py-3 w-full text-left select-none hover:bg-slate-800/50 transition-colors rounded-t-lg"
      >
        <Icon path={icon} size={0.8} className="text-slate-400 shrink-0" />
        <span className="text-sm font-semibold text-slate-100 flex-1 truncate">
          {title}
        </span>

        {/* Custom header actions */}
        {headerActions && !collapsed && (
          <span
            className="flex items-center gap-1"
            onClick={(e) => e.stopPropagation()}
          >
            {headerActions}
          </span>
        )}

        {/* Refresh + timestamp (if panel supports it) */}
        {onRefresh && !collapsed && (
          <span
            className="flex items-center gap-2"
            onClick={(e) => e.stopPropagation()}
          >
            {lastUpdated && (
              <span className="text-xs text-slate-500 hidden sm:inline">
                {t("panel.updated")}{lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              aria-label={t("panel.refreshLabel", { title })}
            >
              <Icon path={mdiRefresh} size={0.7} />
            </Button>
          </span>
        )}

        <Icon
          path={mdiChevronDown}
          size={0.8}
          className={cn(
            "text-slate-500 shrink-0 transition-transform duration-200",
            collapsed && "-rotate-90"
          )}
        />
      </button>

      {/* Content — hidden when collapsed */}
      {!collapsed && <div className="px-4 pb-4">{children}</div>}
    </div>
  );
}
