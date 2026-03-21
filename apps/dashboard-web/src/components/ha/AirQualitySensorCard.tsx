import { useEntity } from "@hakit/core";
import { mdiThermometer, mdiWaterPercent } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { Card, CardContent } from "@/components/ui/card";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { AirQualityConfig } from "@/lib/api/types";

interface AirQualitySensorCardProps {
  config: AirQualityConfig;
}

function SensorValue({ entityId }: { entityId: `sensor.${string}` }) {
  const entity = useEntity(entityId, { returnNullIfNotFound: true });

  const isUnavailable =
    !entity ||
    entity.state === "unavailable" ||
    entity.state === "unknown";

  const value = isUnavailable ? "–" : entity.state;
  const unit = entity?.attributes.unit_of_measurement ?? "";
  const name =
    entity?.attributes.friendly_name ?? entityId.split(".").pop() ?? entityId;

  return (
    <span className="text-xs text-slate-400" title={name}>
      {value}
      {!isUnavailable && unit && (
        <span className="text-slate-500 ml-0.5">{unit}</span>
      )}
    </span>
  );
}

export function AirQualitySensorCard({ config }: AirQualitySensorCardProps) {
  const { t } = useTranslation();

  const tempEntity = useEntity(config.temperature, {
    returnNullIfNotFound: true,
  });
  const humidEntity = useEntity(config.humidity, {
    returnNullIfNotFound: true,
  });

  const tempUnavailable =
    !tempEntity ||
    tempEntity.state === "unavailable" ||
    tempEntity.state === "unknown";
  const humidUnavailable =
    !humidEntity ||
    humidEntity.state === "unavailable" ||
    humidEntity.state === "unknown";

  const tempValue = tempUnavailable ? "–" : tempEntity.state;
  const tempUnit = tempEntity?.attributes.unit_of_measurement ?? "°C";
  const humidValue = humidUnavailable ? "–" : humidEntity.state;
  const humidUnit = humidEntity?.attributes.unit_of_measurement ?? "%";

  return (
    <Card>
      <CardContent className="p-3">
        {/* Primary: Temperature + Humidity large */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <Icon
              path={mdiThermometer}
              size={0.9}
              className="text-sky-400 shrink-0"
            />
            <div>
              <p className="text-xs text-slate-500">
                {t("airQuality.temperature")}
              </p>
              <p className="text-2xl font-semibold text-slate-100 leading-tight">
                {tempValue}
                {!tempUnavailable && (
                  <span className="text-sm font-normal text-slate-400 ml-0.5">
                    {tempUnit}
                  </span>
                )}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Icon
              path={mdiWaterPercent}
              size={0.9}
              className="text-sky-400 shrink-0"
            />
            <div>
              <p className="text-xs text-slate-500">
                {t("airQuality.humidity")}
              </p>
              <p className="text-2xl font-semibold text-slate-100 leading-tight">
                {humidValue}
                {!humidUnavailable && (
                  <span className="text-sm font-normal text-slate-400 ml-0.5">
                    {humidUnit}
                  </span>
                )}
              </p>
            </div>
          </div>
        </div>

        {/* Secondary sensors: small row */}
        {config.secondary.length > 0 && (
          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-slate-800">
            {config.secondary.map((sensorId) => (
              <SensorValue key={sensorId} entityId={sensorId} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
