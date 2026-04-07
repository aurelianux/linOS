import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/** Speed of auto-scroll in pixels per second */
const AUTO_SCROLL_SPEED_PX_PER_SEC = 30;
/** Delay (ms) after user stops scrolling before auto-scroll resumes */
const RESUME_DELAY_MS = 4000;

interface ScrollingHeaderStripProps {
  children: ReactNode;
}

/**
 * Horizontally scrolling strip for header badges.
 * Auto-scrolls right-to-left continuously. When the user manually
 * scrolls (touch/wheel), auto-scroll pauses and resumes after a delay.
 * Loops back to start when reaching the end.
 */
export function ScrollingHeaderStrip({ children }: ScrollingHeaderStripProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const isUserScrolling = useRef(false);
  const resumeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimestamp = useRef<number | null>(null);
  const [isOverflowing, setIsOverflowing] = useState(false);

  // Detect whether content overflows the container
  const checkOverflow = useCallback(() => {
    const el = containerRef.current;
    if (!el) return;
    setIsOverflowing(el.scrollWidth > el.clientWidth + 2);
  }, []);

  useEffect(() => {
    checkOverflow();
    const ro = new ResizeObserver(checkOverflow);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [checkOverflow]);

  // Auto-scroll animation loop using a ref to avoid self-referencing in useCallback
  useEffect(() => {
    if (!isOverflowing) return;

    function tick(timestamp: number) {
      const el = containerRef.current;
      if (!el || isUserScrolling.current) {
        lastTimestamp.current = null;
        rafRef.current = requestAnimationFrame(tick);
        return;
      }

      if (lastTimestamp.current !== null) {
        const dt = (timestamp - lastTimestamp.current) / 1000;
        const dx = AUTO_SCROLL_SPEED_PX_PER_SEC * dt;
        el.scrollLeft += dx;

        // Loop back when reaching the end
        const maxScroll = el.scrollWidth - el.clientWidth;
        if (maxScroll > 0 && el.scrollLeft >= maxScroll - 1) {
          el.scrollLeft = 0;
        }
      }

      lastTimestamp.current = timestamp;
      rafRef.current = requestAnimationFrame(tick);
    }

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastTimestamp.current = null;
    };
  }, [isOverflowing]);

  const pauseAutoScroll = useCallback(() => {
    isUserScrolling.current = true;
    lastTimestamp.current = null;

    if (resumeTimer.current) clearTimeout(resumeTimer.current);
    resumeTimer.current = setTimeout(() => {
      isUserScrolling.current = false;
      resumeTimer.current = null;
    }, RESUME_DELAY_MS);
  }, []);

  // Listen for user interactions that indicate manual scrolling
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const handleWheel = () => pauseAutoScroll();
    const handleTouchStart = () => pauseAutoScroll();
    const handlePointerDown = () => pauseAutoScroll();

    el.addEventListener("wheel", handleWheel, { passive: true });
    el.addEventListener("touchstart", handleTouchStart, { passive: true });
    el.addEventListener("pointerdown", handlePointerDown, { passive: true });

    return () => {
      el.removeEventListener("wheel", handleWheel);
      el.removeEventListener("touchstart", handleTouchStart);
      el.removeEventListener("pointerdown", handlePointerDown);
      if (resumeTimer.current) clearTimeout(resumeTimer.current);
    };
  }, [pauseAutoScroll]);

  return (
    <div
      ref={containerRef}
      className="flex items-center gap-1.5 overflow-x-auto scrollbar-hide"
      style={{
        scrollbarWidth: "none",
        msOverflowStyle: "none",
        WebkitOverflowScrolling: "touch",
      }}
    >
      {children}
    </div>
  );
}
