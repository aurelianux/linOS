import { useCallback, useRef } from "react";
import { mdiChevronUp, mdiChevronDown } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";

interface NumberStepperProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  /** Format the displayed value (e.g. zero-padded) */
  formatValue?: (value: number) => string;
  className?: string;
}

const REPEAT_INITIAL_DELAY_MS = 400;
const REPEAT_INTERVAL_MS = 120;

/**
 * Vertical number stepper with large touch-friendly arrow buttons.
 * Supports hold-to-repeat for fast value changes.
 */
export function NumberStepper({
  value,
  onChange,
  min = 0,
  max = 99,
  step = 1,
  formatValue,
  className,
}: NumberStepperProps) {
  const repeatTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const repeatInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  const clamp = useCallback(
    (v: number) => Math.max(min, Math.min(max, v)),
    [min, max]
  );

  const increment = useCallback(() => {
    onChange(clamp(value + step));
  }, [onChange, clamp, value, step]);

  const decrement = useCallback(() => {
    onChange(clamp(value - step));
  }, [onChange, clamp, value, step]);

  const startRepeat = useCallback(
    (action: () => void) => {
      // Fire once immediately (already handled by onClick)
      // Then start repeating after initial delay
      repeatTimeout.current = setTimeout(() => {
        repeatInterval.current = setInterval(action, REPEAT_INTERVAL_MS);
      }, REPEAT_INITIAL_DELAY_MS);
    },
    []
  );

  const stopRepeat = useCallback(() => {
    if (repeatTimeout.current) {
      clearTimeout(repeatTimeout.current);
      repeatTimeout.current = null;
    }
    if (repeatInterval.current) {
      clearInterval(repeatInterval.current);
      repeatInterval.current = null;
    }
  }, []);

  const displayed = formatValue ? formatValue(value) : String(value);

  return (
    <div className={cn("flex flex-col items-center gap-0.5", className)}>
      {/* Up arrow */}
      <button
        type="button"
        onClick={increment}
        onPointerDown={() => startRepeat(increment)}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
        disabled={value >= max}
        className={cn(
          "w-full flex items-center justify-center",
          "h-10 rounded-lg",
          "bg-slate-800 border border-slate-700",
          "text-slate-300 hover:text-slate-100 hover:bg-slate-700",
          "active:bg-slate-600 transition-colors",
          "disabled:opacity-30 disabled:cursor-not-allowed"
        )}
        aria-label="Increment"
      >
        <Icon path={mdiChevronUp} size={1.2} />
      </button>

      {/* Value display */}
      <div
        className={cn(
          "w-full text-center py-2",
          "text-2xl font-mono font-semibold tabular-nums text-slate-100"
        )}
      >
        {displayed}
      </div>

      {/* Down arrow */}
      <button
        type="button"
        onClick={decrement}
        onPointerDown={() => startRepeat(decrement)}
        onPointerUp={stopRepeat}
        onPointerLeave={stopRepeat}
        disabled={value <= min}
        className={cn(
          "w-full flex items-center justify-center",
          "h-10 rounded-lg",
          "bg-slate-800 border border-slate-700",
          "text-slate-300 hover:text-slate-100 hover:bg-slate-700",
          "active:bg-slate-600 transition-colors",
          "disabled:opacity-30 disabled:cursor-not-allowed"
        )}
        aria-label="Decrement"
      >
        <Icon path={mdiChevronDown} size={1.2} />
      </button>
    </div>
  );
}
