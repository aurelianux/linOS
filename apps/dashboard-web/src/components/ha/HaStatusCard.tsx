import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionStatus } from "./ConnectionStatus";

interface HaStatusCardProps {
  /** Whether HA env vars (VITE_HA_URL / VITE_HA_TOKEN) are configured */
  haConfigured: boolean;
}

/**
 * Card that shows Home Assistant connection status on the Overview page.
 *
 * Renders ConnectionStatus (which uses @hakit/core hooks) only when HA is
 * configured, to avoid calling hooks outside of the HassConnect context.
 */
export function HaStatusCard({ haConfigured }: HaStatusCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Home Assistant</CardTitle>
      </CardHeader>
      <CardContent>
        {haConfigured ? (
          <ConnectionStatus />
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-slate-400">
              HA is not configured. Set{" "}
              <code className="text-slate-300 bg-slate-800 px-1 rounded text-xs">
                VITE_HA_URL
              </code>{" "}
              and{" "}
              <code className="text-slate-300 bg-slate-800 px-1 rounded text-xs">
                VITE_HA_TOKEN
              </code>{" "}
              in <code className="text-slate-300 bg-slate-800 px-1 rounded text-xs">.env</code>{" "}
              to enable real-time smart home integration.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
