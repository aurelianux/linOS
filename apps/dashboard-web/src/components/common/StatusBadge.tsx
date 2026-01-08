import { Badge, type BadgeProps } from "../ui/badge";

export interface StatusBadgeProps extends BadgeProps {
  status: "ok" | "error" | "warning" | "offline";
}

/**
 * Status badge - semantic health indicator
 */
export function StatusBadge({
  status,
  className,
  ...props
}: StatusBadgeProps) {
  const statusConfig = {
    ok: { variant: "success" as const, label: "OK" },
    error: { variant: "destructive" as const, label: "Error" },
    warning: { variant: "warning" as const, label: "Warning" },
    offline: { variant: "secondary" as const, label: "Offline" },
  };

  const { variant, label } = statusConfig[status];

  return (
    <Badge variant={variant} className={className} {...props}>
      {label}
    </Badge>
  );
}
