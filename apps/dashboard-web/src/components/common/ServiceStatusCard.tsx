import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { LoadingState } from "@/components/common/LoadingState";
import { useServiceStatuses } from "@/hooks/useServiceStatuses";
import type { ServiceStatus } from "@/lib/api/types";
import { useTranslation } from "@/lib/i18n/useTranslation";

// ─── Status mappings ────────────────────────────────────────────────────────

const STATUS_DOT: Record<ServiceStatus["status"], string> = {
  ok: "bg-emerald-400",
  error: "bg-red-400",
  unknown: "bg-slate-500",
};

const BADGE_VARIANT: Record<
  ServiceStatus["status"],
  "success" | "destructive" | "secondary"
> = {
  ok: "success",
  error: "destructive",
  unknown: "secondary",
};

// ─── Helpers ────────────────────────────────────────────────────────────────

function formatLatency(ms: number | null): string {
  return ms !== null ? `${ms} ms` : "–";
}

function groupByCategory(statuses: ServiceStatus[]): Map<string, ServiceStatus[]> {
  return statuses.reduce((map, svc) => {
    const list = map.get(svc.category);
    if (list) list.push(svc);
    else map.set(svc.category, [svc]);
    return map;
  }, new Map<string, ServiceStatus[]>());
}

// ─── Sub-components ─────────────────────────────────────────────────────────

function StatusDot({ status }: { status: ServiceStatus["status"] }) {
  return (
    <span className={`h-2 w-2 rounded-full shrink-0 ${STATUS_DOT[status]}`} aria-hidden="true" />
  );
}

function ServiceRow({ svc }: { svc: ServiceStatus }) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <StatusDot status={svc.status} />
        <span className="text-sm text-slate-200">{svc.label}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-slate-500">{formatLatency(svc.latencyMs)}</span>
        <Badge variant={BADGE_VARIANT[svc.status]}>{svc.status}</Badge>
      </div>
    </div>
  );
}

function ServiceList({ statuses }: { statuses: ServiceStatus[] }) {
  const groups = groupByCategory(statuses);
  return (
    <div className="space-y-5">
      {[...groups.entries()].map(([category, services]) => (
        <div key={category}>
          <p className="text-xs font-medium text-slate-500 uppercase tracking-wider mb-2">
            {category}
          </p>
          <div className="space-y-2">
            {services.map((svc) => (
              <ServiceRow key={svc.id} svc={svc} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

/**
 * Generic stack-status card.
 *
 * Reads the list of monitored services from GET /api/services/status (polled
 * every 30 s) and renders them grouped by category. The service list is
 * configured in config/services.json — no code change required when adding a
 * new stack.
 */
export function ServiceStatusCard() {
  const { data: statuses, loading, error, lastUpdated, refresh } = useServiceStatuses();
  const { t } = useTranslation();

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>{t("serviceStatus.title")}</CardTitle>
          <div className="flex items-center gap-3">
            {lastUpdated && (
              <span className="text-xs text-slate-500">
                {t("serviceStatus.updated")}{lastUpdated.toLocaleTimeString()}
              </span>
            )}
            <Button variant="secondary" onClick={refresh} disabled={loading}>
              {t("serviceStatus.refresh")}
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent>
        {loading && !statuses && <LoadingState />}
        {error && !statuses && <p className="text-sm text-red-400">{error}</p>}
        {statuses !== null && statuses.length === 0 && (
          <p className="text-sm text-slate-400">{t("serviceStatus.noServices")}</p>
        )}
        {statuses !== null && statuses.length > 0 && <ServiceList statuses={statuses} />}
      </CardContent>
    </Card>
  );
}
