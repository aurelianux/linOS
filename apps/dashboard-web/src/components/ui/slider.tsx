import * as React from "react";
import { cn } from "../../lib/utils";

export interface SliderProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {
  min?: number;
  max?: number;
  step?: number;
}

/**
 * Simple range slider built on native <input type="range">.
 * Styled with Tailwind to match the slate dark theme.
 */
const Slider = React.forwardRef<HTMLInputElement, SliderProps>(
  ({ className, ...props }, ref) => (
    <input
      type="range"
      ref={ref}
      className={cn(
        "w-full h-2 rounded-full appearance-none cursor-pointer",
        "bg-slate-700",
        "accent-amber-400",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className
      )}
      {...props}
    />
  )
);

Slider.displayName = "Slider";

export { Slider };
