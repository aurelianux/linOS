import type { MutableRefObject } from "react";
import { mdiArrowUp, mdiArrowDown, mdiPalette, mdiPower } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { COLOR_DOT_SIZE, COLOR_DOT_GAP, brightnessToPercent } from "./LightCard.helpers";

interface LightColorPreset { id: string; displayColor: string }

export function HintsOverlay({ presets, isOn }: { presets: LightColorPreset[]; isOn: boolean }) {
  return (
    <div className="absolute inset-0 z-20 pointer-events-none">
      <div className="relative w-full h-full">
        <div className="absolute top-2 left-1/2 -translate-x-1/2">
          <Icon path={mdiArrowUp} size={0.9} className="text-slate-400 animate-pulse" />
        </div>
        <div className="absolute bottom-2 left-1/2 -translate-x-1/2">
          <Icon path={mdiArrowDown} size={0.9} className="text-slate-400 animate-pulse" />
        </div>
        {presets.length > 0 && (
          <div className="absolute left-2 top-1/2 -translate-y-1/2">
            <Icon path={mdiPalette} size={0.9} className="text-slate-400 animate-pulse" />
          </div>
        )}
        {isOn && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2">
            <Icon path={mdiPower} size={0.9} className="text-slate-400 animate-pulse" />
          </div>
        )}
      </div>
    </div>
  );
}

export function ColorPickerOverlay({
  presets,
  dotRefs,
  colorIndex,
}: {
  presets: LightColorPreset[];
  dotRefs: MutableRefObject<(HTMLDivElement | null)[]>;
  colorIndex: number | null;
}) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/85 rounded-lg">
      <div className="flex items-center" style={{ gap: COLOR_DOT_GAP }}>
        {presets.map((preset, idx) => (
          <div
            key={preset.id}
            ref={(el) => { dotRefs.current[idx] = el; }}
            className={cn(
              "rounded-full border-2 transition-all duration-150",
              colorIndex === idx ? "scale-150 border-slate-100 shadow-lg" : "border-slate-600 scale-100"
            )}
            style={{ width: COLOR_DOT_SIZE, height: COLOR_DOT_SIZE, backgroundColor: preset.displayColor }}
          />
        ))}
      </div>
    </div>
  );
}

export function PowerOffOverlay({ offLabel }: { offLabel: string }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-slate-950/85 rounded-lg">
      <div className="flex flex-col items-center gap-1">
        <Icon path={mdiPower} size={1.5} className="text-red-400" />
        <span className="text-xs text-red-400 font-medium">{offLabel}</span>
      </div>
    </div>
  );
}

export function BrightnessOverlay({ brightness }: { brightness: number }) {
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
      <span className="text-3xl font-bold text-slate-100 tabular-nums drop-shadow-lg">{brightness}%</span>
    </div>
  );
}

export function LightCardContent({
  friendlyName, isOn, brightness, showBrightness, hidden, isUnavailable, unavailableLabel,
}: {
  friendlyName: string; isOn: boolean | undefined; brightness: number;
  showBrightness: boolean; hidden: boolean; isUnavailable: boolean; unavailableLabel: string;
}) {
  return (
    <div className={cn("relative z-10 h-full flex flex-col justify-end p-2.5", hidden && "opacity-0")}>
      <div className="flex items-end justify-between">
        <span className={cn("text-sm font-medium truncate transition-colors duration-300", isOn ? "text-slate-100" : "text-slate-400")} title={friendlyName}>
          {friendlyName}
        </span>
        <span className={cn("text-xs tabular-nums ml-2 shrink-0 transition-opacity duration-200", isOn && !showBrightness ? "text-slate-300 opacity-100" : "opacity-0")}>
          {brightnessToPercent(brightness)}%
        </span>
      </div>
      {isUnavailable && <p className="text-xs text-slate-500 mt-0.5">{unavailableLabel}</p>}
    </div>
  );
}
