import { useHaStatus } from "@hakit/core";

/**
 * Compact HA connection indicator for the Header.
 * Shows a colored dot + short label.
 * Must be rendered inside a HassConnect provider context.
 */
export function HaStatusIndicator() {
  const status = useHaStatus();

  const isConnected = status === "RUNNING";
  const isLoading = status === "LOADING";

  const dotClass = [
    "h-2 w-2 rounded-full shrink-0",
    isConnected
      ? "bg-emerald-400"
      : isLoading
        ? "bg-amber-400 animate-pulse"
        : "bg-red-400",
  ].join(" ");

  const label = isLoading ? "Connecting…" : isConnected ? "HA" : "HA Offline";

  return (
    <div
      className="flex items-center gap-1.5"
      aria-label="Home Assistant connection status"
      aria-live="polite"
    >
      <span className={dotClass} aria-hidden="true" />
      <span className="text-xs text-slate-400">{label}</span>
    </div>
  );
}
