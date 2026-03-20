import { useState, useMemo } from "react";
import { useEntity } from "@hakit/core";
import { mdiRobotVacuum, mdiBattery } from "@mdi/js";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import type { RoborockConfig } from "@/lib/api/types";
import type { TranslationKey } from "@/lib/i18n/translations";

// ─── Constants ────────────────────────────────────────────────────────────────

const FAN_POWER_OPTIONS = [
  { value: 101, labelKey: "roborock.suction.silent" as TranslationKey },
  { value: 102, labelKey: "roborock.suction.balanced" as TranslationKey },
  { value: 103, labelKey: "roborock.suction.turbo" as TranslationKey },
  { value: 104, labelKey: "roborock.suction.max" as TranslationKey },
  { value: 105, labelKey: "roborock.suction.custom" as TranslationKey },
  { value: 106, labelKey: "roborock.suction.maxPlus" as TranslationKey },
] as const;

const WATER_BOX_OPTIONS = [
  { value: 200, labelKey: "roborock.mop.off" as TranslationKey },
  { value: 201, labelKey: "roborock.mop.low" as TranslationKey },
  { value: 202, labelKey: "roborock.mop.medium" as TranslationKey },
  { value: 203, labelKey: "roborock.mop.high" as TranslationKey },
] as const;

const VACUUM_STATE_KEYS: Record<string, TranslationKey> = {
  docked: "roborock.state.docked",
  cleaning: "roborock.state.cleaning",
  returning: "roborock.state.returning",
  paused: "roborock.state.paused",
  idle: "roborock.state.idle",
  error: "roborock.state.error",
};

const VACUUM_STATE_VARIANTS: Record<string, "default" | "success" | "warning" | "destructive" | "secondary"> = {
  docked: "secondary",
  cleaning: "success",
  returning: "default",
  paused: "warning",
  idle: "secondary",
  error: "destructive",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

interface ToggleChipProps {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}

function ToggleChip({ label, selected, disabled, onClick }: ToggleChipProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-colors",
        selected
          ? "bg-amber-400/10 text-amber-400 border-amber-400/50"
          : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-600",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {label}
    </button>
  );
}

interface SegmentToggleProps {
  options: ReadonlyArray<{ value: number; labelKey: TranslationKey }>;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

function SegmentToggle({ options, value, disabled, onChange }: SegmentToggleProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={disabled}
          onClick={() => onChange(opt.value)}
          className={cn(
            "px-2.5 py-1 rounded-md text-xs font-medium transition-colors",
            value === opt.value
              ? "bg-slate-700 text-slate-100"
              : "bg-slate-800 text-slate-500 hover:text-slate-400",
            disabled && "opacity-50 cursor-not-allowed"
          )}
        >
          {t(opt.labelKey)}
        </button>
      ))}
    </div>
  );
}

// ─── Panel body ───────────────────────────────────────────────────────────────

interface PanelBodyProps {
  config: RoborockConfig;
}

function RoborockPanelBody({ config }: PanelBodyProps) {
  const { t } = useTranslation();
  const { data: dashConfig } = useDashboardConfig();

  const entity = useEntity(config.entityId as `vacuum.${string}`, {
    returnNullIfNotFound: true,
  });

  const isUnavailable =
    !entity || entity.state === "unavailable" || entity.state === "unknown";

  const vacuumState = entity?.state ?? "unavailable";
  const batteryLevel = (entity?.attributes as Record<string, unknown>)?.battery_level;
  const battery = typeof batteryLevel === "number" ? batteryLevel : null;

  // ─── Local state with config defaults ─────────────────────────────────────

  const defaultRooms = useMemo(
    () => config.segments.filter((s) => s.defaultSelected).map((s) => s.id),
    [config.segments]
  );

  const [selectedRooms, setSelectedRooms] = useState<number[]>(defaultRooms);
  const [cleaningMode, setCleaningMode] = useState(config.defaultCleaningMode);
  const [fanPower, setFanPower] = useState(config.defaultFanPower);
  const [waterBoxMode, setWaterBoxMode] = useState(config.defaultWaterBoxMode);

  // ─── Room name resolution ─────────────────────────────────────────────────

  const roomNameMap = useMemo(() => {
    const rooms = dashConfig?.rooms ?? [];
    const map = new Map<string, string>();
    for (const room of rooms) {
      map.set(room.id, room.name);
    }
    return map;
  }, [dashConfig?.rooms]);

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const toggleRoom = (segmentId: number) => {
    setSelectedRooms((prev) =>
      prev.includes(segmentId)
        ? prev.filter((id) => id !== segmentId)
        : [...prev, segmentId]
    );
  };

  const handleStart = async () => {
    if (!entity || selectedRooms.length === 0 || isUnavailable) return;
    const waterMode = cleaningMode === "vacuum" ? 200 : waterBoxMode;
    try {
      await entity.service.sendCommand({
        serviceData: {
          command: "app_segment_clean",
          params: [
            {
              segments: selectedRooms,
              repeat: 1,
              fan_power: fanPower,
              water_box_mode: waterMode,
            },
          ],
        },
      });
    } catch (err: unknown) {
      console.error("Failed to start vacuum:", err);
    }
  };

  // ─── State badge ──────────────────────────────────────────────────────────

  const stateKey = VACUUM_STATE_KEYS[vacuumState];
  const stateLabel = stateKey ? t(stateKey) : vacuumState;
  const stateVariant = VACUUM_STATE_VARIANTS[vacuumState] ?? "secondary";

  const isCleaning = vacuumState === "cleaning";
  const canStart = !isUnavailable && selectedRooms.length > 0 && !isCleaning;

  return (
    <Card className={cn(isUnavailable && "opacity-50")}>
      <CardContent className="p-5 space-y-4">
        {/* Header */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Icon
              path={mdiRobotVacuum}
              size={1.1}
              className={isCleaning ? "text-amber-400" : "text-slate-400"}
            />
            <span className="text-base font-semibold text-slate-100">
              {t("roborock.title")}
            </span>
          </div>
          <div className="flex items-center gap-2">
            {battery !== null && (
              <span className="flex items-center gap-0.5 text-xs text-slate-400">
                <Icon path={mdiBattery} size={0.6} />
                {battery}%
              </span>
            )}
            <Badge variant={stateVariant}>{stateLabel}</Badge>
          </div>
        </div>

        {/* Room selection */}
        <div className="space-y-1.5">
          <div className="flex flex-wrap gap-2">
            {config.segments.map((seg) => (
              <ToggleChip
                key={seg.id}
                label={roomNameMap.get(seg.roomId) ?? seg.roomId}
                selected={selectedRooms.includes(seg.id)}
                disabled={isUnavailable}
                onClick={() => toggleRoom(seg.id)}
              />
            ))}
          </div>
          {selectedRooms.length === 0 && !isUnavailable && (
            <p className="text-xs text-amber-400">{t("roborock.noRooms")}</p>
          )}
        </div>

        {/* Cleaning mode toggle */}
        <div className="flex rounded-lg overflow-hidden border border-slate-700">
          <button
            type="button"
            disabled={isUnavailable}
            onClick={() => setCleaningMode("vacuum")}
            className={cn(
              "flex-1 py-2 text-xs font-medium transition-colors",
              cleaningMode === "vacuum"
                ? "bg-slate-700 text-slate-100"
                : "bg-slate-800 text-slate-500 hover:text-slate-400",
              isUnavailable && "cursor-not-allowed"
            )}
          >
            {t("roborock.mode.vacuum")}
          </button>
          <button
            type="button"
            disabled={isUnavailable}
            onClick={() => setCleaningMode("vacuum_and_mop")}
            className={cn(
              "flex-1 py-2 text-xs font-medium transition-colors border-l border-slate-700",
              cleaningMode === "vacuum_and_mop"
                ? "bg-slate-700 text-slate-100"
                : "bg-slate-800 text-slate-500 hover:text-slate-400",
              isUnavailable && "cursor-not-allowed"
            )}
          >
            {t("roborock.mode.vacuumAndMop")}
          </button>
        </div>

        {/* Suction power */}
        <div className="space-y-1">
          <span className="text-xs text-slate-500">{t("roborock.suction")}</span>
          <SegmentToggle
            options={FAN_POWER_OPTIONS}
            value={fanPower}
            disabled={isUnavailable}
            onChange={setFanPower}
          />
        </div>

        {/* Mop intensity — only in vacuum_and_mop mode */}
        {cleaningMode === "vacuum_and_mop" && (
          <div className="space-y-1">
            <span className="text-xs text-slate-500">{t("roborock.mop")}</span>
            <SegmentToggle
              options={WATER_BOX_OPTIONS}
              value={waterBoxMode}
              disabled={isUnavailable}
              onChange={setWaterBoxMode}
            />
          </div>
        )}

        {/* Start button */}
        <Button
          className={cn(
            "w-full font-semibold",
            canStart && "bg-amber-500 hover:bg-amber-600 text-slate-950"
          )}
          disabled={!canStart}
          onClick={handleStart}
        >
          {t("roborock.start")}
        </Button>

        {/* Unavailable message */}
        {isUnavailable && (
          <p className="text-xs text-slate-500 text-center">
            {t("entity.unavailable")}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Main export ──────────────────────────────────────────────────────────────

export function RoborockQuickPanel() {
  const { data: dashConfig } = useDashboardConfig();

  if (!dashConfig?.roborock) return null;

  return <RoborockPanelBody config={dashConfig.roborock} />;
}
