import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ConnectionStatus } from "./ConnectionStatus";
import { useTranslation } from "@/lib/i18n/useTranslation";

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
  const { t } = useTranslation();
  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("ha.title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {haConfigured ? (
          <ConnectionStatus />
        ) : (
          <div className="space-y-2">
            <p className="text-sm text-slate-400">{t("ha.notConfigured")}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
