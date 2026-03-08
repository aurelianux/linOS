import * as React from "react";
import { cn } from "../../lib/utils";

export type SwitchProps = Omit<React.InputHTMLAttributes<HTMLInputElement>, "type">;

/**
 * Toggle switch: one sr-only checkbox (state) + one visual span (track + thumb).
 * The peer- utilities on the span react to the hidden input's checked state.
 */
const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, ...props }, ref) => (
    <label className={cn("inline-flex items-center cursor-pointer select-none", className)}>
      <input type="checkbox" ref={ref} className="sr-only peer" {...props} />
      <span
        className={cn(
          "w-11 h-6 rounded-full relative bg-slate-700 cursor-pointer",
          "peer-checked:bg-blue-600 transition-colors duration-300",
          "after:content-[''] after:absolute after:top-0.5 after:left-0.5",
          "after:bg-white after:rounded-full after:h-5 after:w-5",
          "after:transition-transform after:duration-300 peer-checked:after:translate-x-5",
          "peer-focus-visible:ring-2 peer-focus-visible:ring-blue-600",
          "peer-focus-visible:ring-offset-2 peer-focus-visible:ring-offset-slate-950"
        )}
        aria-hidden="true"
      />
    </label>
  )
);

Switch.displayName = "Switch";

export { Switch };
