import { type ReactNode, useEffect, useCallback, useRef } from "react";
import { cn } from "@/lib/utils";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}

/**
 * Mobile bottom sheet / drawer.
 * Slides up from bottom with backdrop overlay.
 * Closes on backdrop tap or drag-down gesture.
 */
export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const touch = e.touches[0];
    if (touch) dragStartY.current = touch.clientY;
  }, []);

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (dragStartY.current === null) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const delta = touch.clientY - dragStartY.current;
      dragStartY.current = null;
      // Close if dragged down more than 80px
      if (delta > 80) onClose();
    },
    [onClose]
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          "fixed inset-0 z-40 bg-slate-950/60 transition-opacity duration-300",
          open ? "opacity-100" : "opacity-0 pointer-events-none"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Sheet */}
      <div
        ref={sheetRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
        className={cn(
          "fixed inset-x-0 bottom-0 z-50",
          "bg-slate-900 border-t border-slate-700 rounded-t-2xl",
          "max-h-[85vh] overflow-y-auto",
          "transition-transform duration-300 ease-out",
          "pb-[calc(env(safe-area-inset-bottom,0px)+16px)]",
          open ? "translate-y-0" : "translate-y-full"
        )}
      >
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-2">
          <div className="w-10 h-1 rounded-full bg-slate-600" />
        </div>

        {title && (
          <div className="px-4 pb-2">
            <h3 className="text-base font-semibold text-slate-100">{title}</h3>
          </div>
        )}

        <div className="px-4 pb-4">{children}</div>
      </div>
    </>
  );
}
