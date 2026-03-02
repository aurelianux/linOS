import { type ReactNode } from "react";
import { HassConnect } from "@hakit/core";

const HA_URL = import.meta.env.VITE_HA_URL ?? "";
const HA_TOKEN = import.meta.env.VITE_HA_TOKEN ?? "";

interface HaProviderProps {
  children: ReactNode;
}

/**
 * Wraps children with the @hakit/core HassConnect provider.
 * Gracefully degrades when VITE_HA_URL / VITE_HA_TOKEN are not set –
 * the dashboard will still render without a live HA connection.
 */
export function HaProvider({ children }: HaProviderProps) {
  if (!HA_URL || !HA_TOKEN) {
    return <>{children}</>;
  }

  return (
    <HassConnect hassUrl={HA_URL} hassToken={HA_TOKEN}>
      {children}
    </HassConnect>
  );
}
