import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merge Tailwind CSS classes with proper precedence
 * @param inputs Class names to merge
 * @returns Merged class string
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

/** Simple throttle — calls fn at most once per ms interval. */
export function throttle<T extends (...args: never[]) => void>(fn: T, ms: number): T {
  let last = 0;
  return ((...args: Parameters<T>) => {
    const now = Date.now();
    if (now - last >= ms) {
      last = now;
      fn(...args);
    }
  }) as T;
}
