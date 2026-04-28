import { useCallback, useEffect, useRef, useState } from "react";
import { useEntity } from "@hakit/core";

export const COLOR_DOT_SIZE = 32;
export const COLOR_DOT_GAP = 12;
export const OPTIMISTIC_CLEAR_MS = 5000;

export function brightnessToPercent(b: number): number {
  return Math.round((b / 255) * 100);
}

export function percentToBrightness(p: number): number {
  return Math.round((p / 100) * 255);
}

export function getLightCss(rgbColor: number[] | undefined, isOn: boolean): string | undefined {
  if (!isOn || !rgbColor || rgbColor.length < 3) return undefined;
  return `rgb(${rgbColor[0]}, ${rgbColor[1]}, ${rgbColor[2]})`;
}

type LightColorPreset = { id: string; displayColor: string; colorTemp?: number; hsColor?: [number, number] };

export function useLightCardActions(
  entity: ReturnType<typeof useEntity<`light.${string}`>>,
  entityId: string,
  isUnavailable: boolean,
  presets: LightColorPreset[]
) {
  const [optimisticBrightness, setOptimisticBrightness] = useState<number | null>(null);
  const optimisticTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const brightness = entity?.attributes.brightness ?? 0;
  const hasConfirmed = optimisticBrightness !== null && brightnessToPercent(brightness) === optimisticBrightness;

  useEffect(() => {
    if (hasConfirmed && optimisticTimer.current) {
      clearTimeout(optimisticTimer.current);
      optimisticTimer.current = null;
    }
    return () => { if (optimisticTimer.current) clearTimeout(optimisticTimer.current); };
  }, [hasConfirmed]);

  const commitBrightness = useCallback((percent: number) => {
    if (!entity || isUnavailable) return;
    const clamped = Math.max(1, Math.min(100, percent));
    setOptimisticBrightness(clamped);
    if (optimisticTimer.current) clearTimeout(optimisticTimer.current);
    optimisticTimer.current = setTimeout(() => { setOptimisticBrightness(null); optimisticTimer.current = null; }, OPTIMISTIC_CLEAR_MS);
    entity.service.turnOn({ serviceData: { brightness: percentToBrightness(clamped) } })
      .catch((err: unknown) => { console.error("Failed to set brightness:", entityId, err); setOptimisticBrightness(null); });
  }, [entity, isUnavailable, entityId]);

  const applyColorPreset = useCallback((index: number) => {
    if (!entity || isUnavailable) return;
    const preset = presets[index];
    if (!preset) return;
    const serviceData: Record<string, unknown> = {};
    if (preset.colorTemp !== undefined) serviceData.color_temp = preset.colorTemp;
    else if (preset.hsColor !== undefined) serviceData.hs_color = preset.hsColor;
    entity.service.turnOn({ serviceData })
      .catch((err: unknown) => { console.error("Failed to apply preset:", entityId, preset.id, err); });
  }, [entity, isUnavailable, entityId, presets]);

  const turnOff = useCallback(async () => {
    if (!entity || isUnavailable) return;
    try { await entity.service.turnOff(); }
    catch (err: unknown) { console.error("Failed to turn off:", entityId, err); }
  }, [entity, isUnavailable, entityId]);

  return { optimisticBrightness, hasConfirmedOptimistic: hasConfirmed, commitBrightness, applyColorPreset, turnOff };
}
