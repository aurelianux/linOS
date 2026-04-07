import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

interface HeaderBadgeProps {
  children: ReactNode;
  /** Optional title/tooltip text */
  title?: string;
  /** Highlight border variant for special states (e.g. motion detected, low battery) */
  variant?: "default" | "warning" | "alert";
  className?: string;
}

/**
 * Unified badge wrapper for header strip items.
 * Provides consistent sizing, padding, border, and background
 * across system metrics, climate, motion, and timer badges.
 */
export function HeaderBadge({
  children,
  title,
  variant = "default",
  className,
}: HeaderBadgeProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-1.5 px-2 py-1 rounded border bg-slate-800 text-xs shrink-0",
        variant === "alert" && "border-red-400/60",
        variant === "warning" && "border-amber-400/50 bg-amber-950/20 shadow-[0_0_8px_rgba(251,191,36,0.25)]",
        variant === "default" && "border-slate-700",
        className
      )}
      title={title}
    >
      {children}
    </div>
  );
}
