import { cn } from "@/lib/utils";

interface IconProps {
  path: string;
  size?: number;
  className?: string;
  title?: string;
}

/**
 * SVG icon component — renders an MDI icon path from @mdi/js.
 * Drop-in replacement for @mdi/react's Icon, compatible with React 19.
 */
export function Icon({ path, size = 1, className, title }: IconProps) {
  const px = size * 24;
  return (
    <svg
      viewBox="0 0 24 24"
      width={px}
      height={px}
      className={cn("inline-block shrink-0", className)}
      role={title ? "img" : "presentation"}
      aria-hidden={!title}
    >
      {title && <title>{title}</title>}
      <path d={path} fill="currentColor" />
    </svg>
  );
}
