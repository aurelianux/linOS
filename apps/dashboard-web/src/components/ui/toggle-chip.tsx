import { cn } from "@/lib/utils";

interface ToggleChipProps {
  label: string;
  selected: boolean;
  disabled?: boolean;
  onClick: () => void;
}

/**
 * Rounded pill chip for multi-select scenarios (room selection, tag selection).
 * Consistent style across QuickAccess and Roborock panels.
 */
export function ToggleChip({ label, selected, disabled, onClick }: ToggleChipProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200",
        "select-none",
        selected
          ? "bg-amber-400/10 text-amber-400 border-amber-400/50"
          : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200",
        disabled && "opacity-50 cursor-not-allowed"
      )}
    >
      {label}
    </button>
  );
}
