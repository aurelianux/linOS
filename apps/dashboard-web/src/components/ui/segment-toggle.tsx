import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { TranslationKey } from "@/lib/i18n/translations";

interface SegmentToggleOption {
  value: number;
  labelKey: TranslationKey;
}

interface SegmentToggleProps {
  options: ReadonlyArray<SegmentToggleOption>;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
}

/**
 * Horizontal segment control for selecting one of N options.
 * Used for suction power, mop intensity, and similar multi-option selectors.
 */
export function SegmentToggle({ options, value, disabled, onChange }: SegmentToggleProps) {
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
