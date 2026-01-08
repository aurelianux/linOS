import * as React from "react";
import { cn } from "../../lib/utils";

export interface SwitchProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "type"> {}

const Switch = React.forwardRef<HTMLInputElement, SwitchProps>(
  ({ className, ...props }, ref) => (
    <label
      className={cn(
        "inline-flex items-center cursor-pointer select-none",
        className
      )}
    >
      <input
        type="checkbox"
        ref={ref}
        className={cn(
          "sr-only peer",
          "appearance-none w-11 h-6 bg-slate-700 rounded-full relative cursor-pointer",
          "checked:bg-blue-600",
          "transition-colors duration-300",
          "after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform after:duration-300",
          "peer-checked:after:translate-x-5"
        )}
        {...props}
      />
      <input
        type="checkbox"
        ref={ref}
        className={cn(
          "appearance-none w-11 h-6 bg-slate-700 rounded-full relative cursor-pointer peer",
          "checked:bg-blue-600",
          "transition-colors duration-300",
          "after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-transform after:duration-300",
          "checked:after:translate-x-5 focus-visible:ring-2 focus-visible:ring-blue-600 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950"
        )}
        {...props}
      />
    </label>
  )
);

Switch.displayName = "Switch";

export { Switch };
