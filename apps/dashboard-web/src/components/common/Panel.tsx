import { type ReactNode } from "react";
import { mdiRefresh } from "@mdi/js";
import Icon from "@mdi/react";
import { Button } from "@/components/ui/button";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface PanelProps {
  title: string;
  children: ReactNode;
  /** Called when the user clicks the refresh button */
  onRefresh?: () => void;
  /** Shows the refresh button as disabled (still visible during initial load) */
  loading?: boolean;
  /** Timestamp of the last successful data fetch */
  lastUpdated?: Date | null;
  className?: string;
}

/**
 * Reusable panel container for information-dense widgets on the Panels page.
 *
 * Larger than a Card — spans the full width of its grid cell.
 * Includes:
 * - Title bar with an optional manual refresh button
 * - "Updated at …" timestamp
 * - Scrollable content area
 */
export function Panel({
  title,
  children,
  onRefresh,
  loading = false,
  lastUpdated,
  className = "",
}: PanelProps) {
  const { t } = useTranslation();

  return (
    <div
      className={[
        "rounded-lg border border-slate-800 bg-slate-900 flex flex-col",
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {/* Title bar */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 shrink-0">
        <h3 className="text-lg font-semibold text-slate-100">{title}</h3>

        <div className="flex items-center gap-3">
          {lastUpdated && (
            <span className="text-xs text-slate-500">
              {t("panel.updated")}{lastUpdated.toLocaleTimeString()}
            </span>
          )}
          {onRefresh && (
            <Button
              variant="secondary"
              size="sm"
              onClick={onRefresh}
              disabled={loading}
              aria-label={t("panel.refreshLabel", { title })}
            >
              <Icon path={mdiRefresh} size={0.8} className="mr-1" />
              {t("panel.refresh")}
            </Button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6 flex-1">{children}</div>
    </div>
  );
}
