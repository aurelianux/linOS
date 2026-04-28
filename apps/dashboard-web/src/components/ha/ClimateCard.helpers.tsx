import { cn } from "@/lib/utils";

export const HVAC_COLORS: Record<string, string> = {
  heating: "text-amber-400",
  cooling: "text-sky-400",
  heat_cool: "text-amber-400",
  auto: "text-emerald-400",
  off: "text-slate-500",
  idle: "text-slate-400",
};

export const TEMP_PRESETS = [8, 18, 21, 23] as const;
export const PENDING_TIMEOUT_MS = 15_000;

interface TempPresetsProps {
  presets: readonly number[];
  activeTemp: number | undefined;
  onSelect: (temp: number) => void;
  isUnavailable: boolean;
  unavailableLabel: string;
}

export function TempPresets({ presets, activeTemp, onSelect, isUnavailable, unavailableLabel }: TempPresetsProps) {
  if (isUnavailable) {
    return <span className="text-xs text-slate-500 w-full text-center">{unavailableLabel}</span>;
  }
  return (
    <>
      {presets.map((temp) => {
        const isActive = activeTemp === temp;
        return (
          <button
            key={temp}
            type="button"
            onClick={(e) => { e.stopPropagation(); onSelect(temp); }}
            className={cn(
              "flex-1 py-1 rounded-md text-xs font-medium tabular-nums transition-all duration-200",
              isActive
                ? "bg-amber-400 text-slate-950 shadow-sm"
                : "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200"
            )}
          >
            {temp}°
          </button>
        );
      })}
    </>
  );
}
