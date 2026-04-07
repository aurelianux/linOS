import { HaStatusIndicator } from "@/components/ha/HaStatusIndicator";
import { HeaderBadge } from "@/components/layout/HeaderBadge";
import { ScrollingHeaderStrip } from "@/components/layout/ScrollingHeaderStrip";
import { SystemMetricBadge } from "@/components/layout/SystemMetricBadge";
import { TimerHeaderBadge } from "@/components/layout/TimerHeaderBadge";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useMetricHistory } from "@/hooks/useMetricHistory";
import { useSystemVitals } from "@/hooks/useSystemVitals";
import type { AirQualityConfig, DashboardRoom } from "@/lib/api/types";
import { HA_CONFIGURED } from "@/lib/ha/config";
import { resolveDashboardIcon } from "@/lib/ha/dashboardIcons";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useLanguageStore } from "@/stores/languageStore";
import { cn } from "@/lib/utils";
import { useEntity, useHass } from "@hakit/core";
import {
  mdiThermometer,
  mdiWaterPercent,
  mdiBatteryLow,
  mdiMotionSensor,
} from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { useState, useEffect } from "react";

function extractBatteryEntityId(
  secondary: Array<`sensor.${string}`>
): `sensor.${string}` | undefined {
  return secondary.find((id) => id.endsWith("_battery"));
}

function getClimateRooms(rooms: DashboardRoom[]): Array<{
  room: DashboardRoom;
  airQuality: AirQualityConfig;
}> {
  return rooms
    .filter((r): r is DashboardRoom & { airQuality: AirQualityConfig } => !!r.airQuality)
    .map((r) => ({ room: r, airQuality: r.airQuality }));
}

// ── Shared helpers ──────────────────────────────────────────────────────────

const BATTERY_LOW_THRESHOLD = 15;
const MOTION_GRACE_PERIOD_S = 10;

function getTemperatureColor(temp: number | null): string {
  if (temp === null) return "text-slate-500";
  if (temp <= 16) return "text-blue-400";
  if (temp <= 19) return "text-sky-400";
  if (temp <= 22) return "text-emerald-400";
  if (temp <= 25) return "text-amber-400";
  return "text-red-400";
}

function formatElapsed(totalSeconds: number): string {
  if (totalSeconds < 60) return `${totalSeconds}s`;
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  if (minutes < 60) return `${minutes}m ${seconds}s`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return `${hours}h ${remainingMinutes}m`;
}

// ── Inline badge components ─────────────────────────────────────────────────
// Each uses HeaderBadge for consistent styling

function useEntityValue(entityId: `sensor.${string}`) {
  const entity = useEntity(entityId, { returnNullIfNotFound: true });
  const isUnavailable =
    !entity || entity.state === "unavailable" || entity.state === "unknown";
  return {
    value: isUnavailable ? "–" : entity.state,
    numericValue: isUnavailable ? null : Number(entity.state),
    unit: entity?.attributes.unit_of_measurement ?? "",
    isUnavailable,
  };
}

function useBatteryLevel(entityId: `sensor.${string}` | undefined): number | null {
  const state = useHass((s) =>
    entityId ? (s.entities[entityId]?.state as string | undefined) : undefined
  );
  if (!entityId || !state || state === "unavailable" || state === "unknown") {
    return null;
  }
  return Number(state);
}

/** System metrics badge — CPU + RAM in one unified badge */
function SystemBadge() {
  const { data } = useSystemVitals();
  const cpuHistory = useMetricHistory(data?.cpuLoadPercent ?? null);
  const ramHistory = useMetricHistory(data?.memoryUsedPercent ?? null);

  if (!data) return null;

  return (
    <HeaderBadge>
      <SystemMetricBadge
        label="CPU"
        percent={data.cpuLoadPercent}
        history={cpuHistory}
      />
      <span className="text-slate-600 mx-0.5">|</span>
      <SystemMetricBadge
        label="RAM"
        percent={data.memoryUsedPercent}
        history={ramHistory}
      />
    </HeaderBadge>
  );
}

/** Climate badge — temperature + humidity for one room */
function ClimateBadge({
  roomKey,
  icon,
  temperatureEntityId,
  humidityEntityId,
  batteryEntityId,
}: {
  roomKey: string;
  icon: string;
  temperatureEntityId: `sensor.${string}`;
  humidityEntityId: `sensor.${string}`;
  batteryEntityId?: `sensor.${string}`;
}) {
  const { t } = useTranslation();
  const temp = useEntityValue(temperatureEntityId);
  const humid = useEntityValue(humidityEntityId);
  const battery = useBatteryLevel(batteryEntityId);

  const isBatteryLow = battery !== null && battery < BATTERY_LOW_THRESHOLD;
  const roomLabel = t(`room.${roomKey}` as Parameters<typeof t>[0]);
  const tempColor = getTemperatureColor(temp.numericValue);

  return (
    <HeaderBadge
      title={isBatteryLow ? `${roomLabel}: ${t("header.climate.lowBattery")} (${battery}%)` : roomLabel}
      variant={isBatteryLow ? "alert" : "default"}
    >
      <Icon path={icon} size={0.55} className="text-slate-400" />
      <div className="flex items-center gap-0.5">
        <Icon path={mdiThermometer} size={0.45} className={tempColor} />
        <span className={cn("font-semibold tabular-nums", temp.isUnavailable ? "text-slate-500" : tempColor)}>
          {temp.value}
          {!temp.isUnavailable && <span className="text-slate-500 font-normal">{temp.unit}</span>}
        </span>
      </div>
      <div className="flex items-center gap-0.5">
        <Icon path={mdiWaterPercent} size={0.45} className="text-sky-400" />
        <span className={cn("font-semibold tabular-nums", humid.isUnavailable ? "text-slate-500" : "text-slate-100")}>
          {humid.value}
          {!humid.isUnavailable && <span className="text-slate-500 font-normal">{humid.unit}</span>}
        </span>
      </div>
      {isBatteryLow && (
        <div className="flex items-center gap-0.5">
          <Icon path={mdiBatteryLow} size={0.45} className="text-red-400" />
          <span className="text-red-400 font-semibold tabular-nums">{battery}%</span>
        </div>
      )}
    </HeaderBadge>
  );
}

/**
 * Compute elapsed seconds since lastChanged using an interval.
 * Avoids calling Date.now() during render (lint: react-hooks/purity).
 */
function useElapsedSince(lastChanged: string | undefined, shouldTick: boolean): number {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    function compute() {
      if (!lastChanged) return 0;
      return Math.max(0, Math.floor((Date.now() - new Date(lastChanged).getTime()) / 1000));
    }

    // Tick immediately on mount + when lastChanged changes via interval (every 100ms for first tick, then 1s)
    const initialId = setTimeout(() => setElapsed(compute()), 0);

    if (!shouldTick) return () => clearTimeout(initialId);

    const id = setInterval(() => setElapsed(compute()), 1000);
    return () => {
      clearTimeout(initialId);
      clearInterval(id);
    };
  }, [lastChanged, shouldTick]);

  return elapsed;
}

/** Motion sensor badge — shows motion status for one sensor */
function MotionBadge({
  entityId,
  roomKey,
}: {
  entityId: `binary_sensor.${string}`;
  roomKey: string;
}) {
  const { t } = useTranslation();
  const entity = useHass((s) => s.entities[entityId] as {
    state: string;
    last_changed: string;
    attributes: Record<string, unknown>;
  } | undefined);

  const isUnavailable =
    !entity || entity.state === "unavailable" || entity.state === "unknown";
  const isMotion = entity?.state === "on";
  const lastChanged = entity?.last_changed;

  // Tick elapsed counter only when not in motion and not unavailable
  const elapsedSeconds = useElapsedSince(lastChanged, !isUnavailable && !isMotion);

  const isRecent = !isMotion && !isUnavailable && elapsedSeconds < MOTION_GRACE_PERIOD_S;
  const isActive = isMotion || isRecent;

  const roomLabel = t(`room.${roomKey}` as Parameters<typeof t>[0]);

  return (
    <HeaderBadge title={roomLabel} variant={isActive ? "warning" : "default"}>
      <Icon
        path={mdiMotionSensor}
        size={0.55}
        className={cn(
          "transition-colors",
          isUnavailable ? "text-slate-600" : isActive ? "text-amber-400" : "text-slate-400"
        )}
      />
      {isUnavailable ? (
        <span className="text-slate-600">–</span>
      ) : isActive ? (
        <span className="font-semibold text-amber-400">{t("header.motion.detected")}</span>
      ) : (
        <span className="tabular-nums text-slate-400">
          {t("header.motion.clear")}{" "}
          <span className="font-semibold text-slate-300">{formatElapsed(elapsedSeconds)}</span>
        </span>
      )}
    </HeaderBadge>
  );
}

// ── Main header ─────────────────────────────────────────────────────────────

/**
 * Header component with auto-scrolling badge strip.
 * All badges (system metrics, climate, motion, timer) use the same
 * HeaderBadge wrapper for consistent sizing on both mobile and desktop.
 * The strip auto-scrolls right-to-left; manual scroll pauses auto-scroll.
 */
export function Header() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguageStore();
  const { data: dashConfig } = useDashboardConfig();

  const climateRooms = HA_CONFIGURED ? getClimateRooms(dashConfig?.rooms ?? []) : [];
  const motionSensors = HA_CONFIGURED ? (dashConfig?.motionSensors ?? []) : [];

  return (
    <header className="flex items-center justify-between h-10 md:h-14 px-3 md:px-6 border-b border-slate-700 bg-slate-950 shrink-0 gap-2">
      {/* Left: logo */}
      <h1 className="text-base md:text-2xl font-bold text-slate-100 shrink-0">
        {t("appTitle")}
      </h1>

      {/* Center: scrolling badge strip — takes remaining space */}
      <div className="flex-1 min-w-0 mx-2">
        <ScrollingHeaderStrip>
          {/* Timer badge (only visible when active) */}
          <TimerHeaderBadge />
          {/* System metrics */}
          <SystemBadge />
          {/* Climate rooms */}
          {climateRooms.map(({ room, airQuality }) => (
            <ClimateBadge
              key={room.id}
              roomKey={room.id}
              icon={resolveDashboardIcon(room.icon)}
              temperatureEntityId={airQuality.temperature}
              humidityEntityId={airQuality.humidity}
              batteryEntityId={extractBatteryEntityId(airQuality.secondary)}
            />
          ))}
          {/* Motion sensors */}
          {motionSensors.map((sensor) => (
            <MotionBadge
              key={sensor.id}
              entityId={sensor.entityId}
              roomKey={sensor.id}
            />
          ))}
        </ScrollingHeaderStrip>
      </div>

      {/* Right: desktop-only controls */}
      <div className="hidden md:flex items-center gap-3 shrink-0">
        {HA_CONFIGURED && <HaStatusIndicator />}
        <button
          onClick={() => setLanguage(language === "de" ? "en" : "de")}
          className="text-xs font-medium text-slate-400 hover:text-slate-100 transition-colors px-2 py-1 rounded border border-slate-700 hover:border-slate-500"
          aria-label="Switch language"
        >
          {t("lang.switch")}
        </button>
        <div className="text-sm text-slate-400">{t("appVersion")}</div>
      </div>
    </header>
  );
}
