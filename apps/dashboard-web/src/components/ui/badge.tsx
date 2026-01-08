import * as React from "react";
import { cn } from "../../lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: "default" | "secondary" | "destructive" | "success" | "warning";
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = "default", ...props }, ref) => {
    const variantStyles = {
      default: "bg-blue-900 text-blue-200 border border-blue-700",
      secondary: "bg-slate-700 text-slate-100 border border-slate-600",
      destructive: "bg-red-900 text-red-200 border border-red-700",
      success: "bg-green-900 text-green-200 border border-green-700",
      warning: "bg-yellow-900 text-yellow-200 border border-yellow-700",
    };

    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
          variantStyles[variant],
          className
        )}
        {...props}
      />
    );
  }
);

Badge.displayName = "Badge";

export { Badge };
