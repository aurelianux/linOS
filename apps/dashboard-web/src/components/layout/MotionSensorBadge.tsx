import { useState, useEffect } from "react";
import { useHass } from "@hakit/core";
import { mdiMotionSensor } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { cn } from "@/lib/utils";

const MOTION_GRACE_PERIOD_S = 10;

function formatElapsed(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

function useMotionState(entityId: `binary_sensor.${string}`) {
  const entity = useHass((s) => s.entities[entityId] as {
    state: string;
    last_changed: string;
    attributes: Record<string, unknown>;
  } | undefined);
  const [nowMs, setNowMs] = useState(0);

  const isUnavailable =
    !entity || entity.state === "unavailable" || entity.state === "unknown";
  const isMotion = entity?.state === "on";

  const lastChanged = entity?.last_changed;
  const elapsedSeconds =
    lastChanged && nowMs > 0
      ? Math.max(0, Math.floor((nowMs - new Date(lastChanged).getTime()) / 1000))
      : 0;

  const isRecent = !isMotion && !isUnavailable && elapsedSeconds < MOTION_GRACE_PERIOD_S;
  const isActive = isMotion || isRecent;

  useEffect(() => {
    // Only tick when state is "off" — need to update elapsed display.
    // When "on", HA WebSocket push triggers re-renders via the store.
    if (isUnavailable || isMotion || !lastChanged) return;
    const updateNow = () => setNowMs(Date.now());
    updateNow();
    const id = setInterval(updateNow, 1000);
    return () => clearInterval(id);
  }, [isUnavailable, isMotion, lastChanged]);

  return { isMotion, isActive, elapsedSeconds, isUnavailable };
}

interface MotionSensorBadgeProps {
  entityId: `binary_sensor.${string}`;
  roomKey: string;
}

/** Desktop motion sensor header badge with amber glow on detection. */
export function MotionSensorBadge({ entityId, roomKey }: MotionSensorBadgeProps) {
  const { t } = useTranslation();
  const { isActive, elapsedSeconds, isUnavailable } = useMotionState(entityId);

  const roomLabel = t(`room.${roomKey}` as Parameters<typeof t>[0]);

  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded border transition-colors",
        isActive
          ? "border-amber-400/50 bg-amber-950/20 shadow-[0_0_8px_rgba(251,191,36,0.25)]"
          : "border-slate-700 bg-slate-800"
      )}
      title={roomLabel}
    >
      <Icon
        path={mdiMotionSensor}
        size={0.55}
        className={cn(
          "transition-colors",
          isUnavailable ? "text-slate-600" : isActive ? "text-amber-400" : "text-slate-400"
        )}
      />
      {isUnavailable ? (
        <span className="text-xs text-slate-600">–</span>
      ) : isActive ? (
        <span className="text-xs font-semibold text-amber-400">
          {t("header.motion.detected")}
        </span>
      ) : (
        <span className="text-xs tabular-nums text-slate-400">
          {t("header.motion.clear")}{" "}
          <span className="font-semibold text-slate-300">{formatElapsed(elapsedSeconds)}</span>
        </span>
      )}
    </div>
  );
}

/** Compact mobile motion sensor badge. */
export function MobileMotionBadge({ entityId, roomKey }: MotionSensorBadgeProps) {
  const { t } = useTranslation();
  const { isActive, elapsedSeconds, isUnavailable } = useMotionState(entityId);

  const roomLabel = t(`room.${roomKey}` as Parameters<typeof t>[0]);

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-1.5 py-0.5 rounded border transition-colors",
        isActive
          ? "border-amber-400/50 bg-amber-950/20"
          : "border-slate-700 bg-slate-800"
      )}
      title={roomLabel}
    >
      <Icon
        path={mdiMotionSensor}
        size={0.45}
        className={cn(
          isUnavailable ? "text-slate-600" : isActive ? "text-amber-400" : "text-slate-400"
        )}
      />
      {isUnavailable ? (
        <span className="text-xs text-slate-600">–</span>
      ) : isActive ? (
        <span className="text-xs font-semibold text-amber-400">!</span>
      ) : (
        <span className="text-xs tabular-nums font-semibold text-slate-300">
          {formatElapsed(elapsedSeconds)}
        </span>
      )}
    </div>
  );
}
