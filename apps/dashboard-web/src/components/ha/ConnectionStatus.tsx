import { useHaStatus } from "@hakit/core";
import { Badge } from "@/components/ui/badge";
import { useTranslation } from "@/lib/i18n/useTranslation";

/**
 * Displays the current Home Assistant connection status.
 * Uses @hakit/core's useHaStatus hook for real-time status.
 * Only renders inside a HassConnect provider context.
 */
export function ConnectionStatus() {
  const status = useHaStatus();
  const { t } = useTranslation();

  const isConnected = status === "RUNNING";
  const isLoading = status === "LOADING";

  return (
    <div className="flex items-center gap-2">
      <span
        className={[
          "h-2 w-2 rounded-full",
          isConnected
            ? "bg-emerald-400"
            : isLoading
              ? "bg-amber-400 animate-pulse"
              : "bg-red-400",
        ].join(" ")}
        aria-hidden="true"
      />
      <Badge
        variant={isConnected ? "default" : "secondary"}
        className="text-xs"
      >
        {isLoading ? t("ha.connecting") : isConnected ? t("ha.connected") : t("ha.offline")}
      </Badge>
    </div>
  );
}
