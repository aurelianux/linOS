import { useState, useEffect, useRef, useCallback } from "react";

const SUPPRESSION_MS = 300;

/**
 * Tracks scroll/touch-move events on the window and returns true
 * for ~300ms after the last scroll, suppressing accidental taps.
 * Only active on touch devices (passive listeners).
 */
export function useScrollSuppression(): boolean {
  const [suppressed, setSuppressed] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleScrollOrMove = useCallback(() => {
    setSuppressed(true);
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => setSuppressed(false), SUPPRESSION_MS);
  }, []);

  useEffect(() => {
    window.addEventListener("touchmove", handleScrollOrMove, { passive: true });
    window.addEventListener("scroll", handleScrollOrMove, { passive: true });

    return () => {
      window.removeEventListener("touchmove", handleScrollOrMove);
      window.removeEventListener("scroll", handleScrollOrMove);
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [handleScrollOrMove]);

  return suppressed;
}
