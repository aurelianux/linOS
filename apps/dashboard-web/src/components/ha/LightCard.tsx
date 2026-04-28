import { useEntity } from "@hakit/core";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useLightGesture } from "@/hooks/useLightGesture";
import { useMemo, useRef } from "react";
import {
  brightnessToPercent,
  getLightCss,
  useLightCardActions,
} from "./LightCard.helpers";
import {
  HintsOverlay,
  ColorPickerOverlay,
  PowerOffOverlay,
  BrightnessOverlay,
  LightCardContent,
} from "./LightCard.overlays";

const CARD_HEIGHT = 140;

interface LightCardProps {
  entityId: `light.${string}`;
}

export function LightCard({ entityId }: LightCardProps) {
  const entity = useEntity(entityId, { returnNullIfNotFound: true });
  const { t } = useTranslation();
  const { data: dashConfig } = useDashboardConfig();
  const cardRef = useRef<HTMLDivElement>(null);
  const presets = useMemo(() => dashConfig?.lightColorPresets ?? [], [dashConfig?.lightColorPresets]);

  const isUnavailable = !entity || entity.state === "unavailable" || entity.state === "unknown";
  const isOn = entity?.state === "on";
  const brightness = entity?.attributes.brightness ?? 0;
  const rgbColor = entity?.attributes.rgb_color as number[] | undefined;
  const friendlyName = entity?.attributes.friendly_name ?? entityId.split(".")[1] ?? entityId;

  const { optimisticBrightness, hasConfirmedOptimistic, commitBrightness, applyColorPreset, turnOff } =
    useLightCardActions(entity, entityId, isUnavailable, presets);

  const { showHints, direction, dragBrightness, colorIndex, dotRefs, handlers } = useLightGesture({
    cardRef, isOn: isOn ?? false, brightness, isUnavailable,
    presetCount: presets.length, onBrightnessCommit: commitBrightness,
    onColorSelect: applyColorPreset, onTurnOff: turnOff,
  });

  const actualBrightness = brightnessToPercent(brightness);
  const effectiveOptimistic = hasConfirmedOptimistic ? null : optimisticBrightness;
  const displayBrightness = dragBrightness !== null ? dragBrightness : effectiveOptimistic ?? actualBrightness;
  const fillPercent = dragBrightness !== null ? displayBrightness : effectiveOptimistic ?? (isOn ? actualBrightness : 0);
  const lightColor = getLightCss(rgbColor, isOn ?? false);

  const showBrightness = direction === "vertical";
  const showColorPicker = direction === "left";
  const showPowerOff = direction === "right";

  return (
    <Card
      ref={cardRef}
      {...handlers}
      style={{ height: CARD_HEIGHT, touchAction: "none" }}
      className={cn("cursor-pointer select-none mx-2 md:mx-0", isOn ? "border-amber-900/40" : "border-slate-700", isUnavailable && "opacity-50 pointer-events-none")}
    >
      <div
        className={cn("absolute inset-x-0 bottom-0 rounded-b-lg", showBrightness ? "transition-none" : "transition-all duration-500 ease-out")}
        style={{ height: `${fillPercent}%`, backgroundColor: lightColor ?? "rgb(251 191 36 / 0.15)", opacity: lightColor ? 0.25 : 1 }}
      />
      {showHints && <HintsOverlay presets={presets} isOn={isOn ?? false} />}
      {showColorPicker && <ColorPickerOverlay presets={presets} dotRefs={dotRefs} colorIndex={colorIndex} />}
      {showPowerOff && <PowerOffOverlay offLabel={t("lights.off")} />}
      {showBrightness && <BrightnessOverlay brightness={displayBrightness} />}
      <LightCardContent
        friendlyName={friendlyName}
        isOn={isOn}
        brightness={brightness}
        showBrightness={showBrightness}
        hidden={showColorPicker || showPowerOff}
        isUnavailable={isUnavailable}
        unavailableLabel={t("entity.unavailable")}
      />
    </Card>
  );
}
