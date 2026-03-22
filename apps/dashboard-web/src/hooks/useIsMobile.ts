import { useState, useEffect } from "react";

const MD_BREAKPOINT = 768;

/**
 * Returns true when viewport width is below Tailwind's md breakpoint (768px).
 * Uses matchMedia for efficient listener-based updates.
 */
export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(
    () => window.innerWidth < MD_BREAKPOINT
  );

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MD_BREAKPOINT - 1}px)`);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, []);

  return isMobile;
}
