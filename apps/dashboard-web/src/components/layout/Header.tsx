import { HaStatusIndicator } from "@/components/ha/HaStatusIndicator";
import { ScrollingHeaderStrip } from "@/components/layout/ScrollingHeaderStrip";
import { TimerHeaderBadge } from "@/components/layout/TimerHeaderBadge";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { HA_CONFIGURED } from "@/lib/ha/config";
import { resolveDashboardIcon } from "@/lib/ha/dashboardIcons";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useLanguageStore } from "@/stores/languageStore";
import { SystemBadge, ClimateBadge, MotionBadge } from "./Header.badges";
import { extractBatteryEntityId, getClimateRooms } from "./Header.helpers";

export function Header() {
  const { t } = useTranslation();
  const { language, setLanguage } = useLanguageStore();
  const { data: dashConfig } = useDashboardConfig();

  const climateRooms = HA_CONFIGURED ? getClimateRooms(dashConfig?.rooms ?? []) : [];
  const motionSensors = HA_CONFIGURED ? (dashConfig?.motionSensors ?? []) : [];

  return (
    <header className="flex items-center justify-between h-10 md:h-14 px-3 md:px-6 border-b border-slate-700 bg-slate-950 shrink-0 gap-2">
      <h1 className="text-base md:text-2xl font-bold text-slate-100 shrink-0">{t("appTitle")}</h1>

      <div className="flex-1 min-w-0 mx-2">
        <ScrollingHeaderStrip>
          <TimerHeaderBadge />
          <SystemBadge />
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
          {motionSensors.map((sensor) => (
            <MotionBadge key={sensor.id} entityId={sensor.entityId} roomKey={sensor.id} />
          ))}
        </ScrollingHeaderStrip>
      </div>

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
