import { useEffect, useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { StatusBadge } from "../components/common/StatusBadge";
import { LoadingState } from "../components/common/LoadingState";
import { ErrorState } from "../components/common/ErrorState";
import { EntityCard } from "../components/ha/EntityCard";
import { fetchJson, ApiErrorException } from "../lib/api/client";
import { useHaStates, useHaService } from "../hooks/useHomeAssistant";
import type { HealthResponse } from "../lib/api/types";
import { entityDomain, TOGGLEABLE_DOMAINS } from "../lib/api/types";

/** Maximum number of quick-control cards shown in the overview */
const MAX_QUICK_CONTROLS = 8;

/**
 * Overview page – API health + Home Assistant quick controls
 */
export function OverviewPage() {
  const [healthLoading, setHealthLoading] = useState(true);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);

  const fetchHealth = async () => {
    setHealthLoading(true);
    setHealthError(null);
    try {
      const data = await fetchJson<HealthResponse>("/health");
      setHealth(data);
    } catch (err) {
      if (err instanceof ApiErrorException) {
        setHealthError(err.message);
      } else {
        setHealthError("Unknown error");
      }
    } finally {
      setHealthLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  // Home Assistant: grab all toggleable entities for quick controls
  const { states, loading: haLoading, error: haError, refresh: haRefresh } = useHaStates();
  const { callService, pending } = useHaService();

  /** Only toggleable entities, sorted: on first */
  const quickControls = useMemo(() => {
    return states
      .filter((s) => TOGGLEABLE_DOMAINS.has(entityDomain(s.entity_id)))
      .sort((a, b) => {
        if (a.state === b.state) return 0;
        return a.state === "on" ? -1 : 1;
      })
      .slice(0, MAX_QUICK_CONTROLS);
  }, [states]);

  const lightsOn = useMemo(
    () => states.filter((s) => entityDomain(s.entity_id) === "light" && s.state === "on").length,
    [states]
  );

  async function handleToggle(entityId: string, currentState: string) {
    const domain = entityDomain(entityId);
    const service = currentState === "on" ? "turn_off" : "turn_on";
    await callService(domain, service, { entity_id: entityId });
    setTimeout(haRefresh, 800);
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-100 mb-2">Overview</h2>
        <p className="text-slate-400">Welcome to linBoard v0.1</p>
      </div>

      {/* API Health */}
      <Card>
        <CardHeader>
          <CardTitle>API Health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {healthLoading && <LoadingState />}
          {healthError && <ErrorState message={healthError} onRetry={fetchHealth} />}
          {health && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-slate-300">API Status</span>
                <StatusBadge status="ok" />
              </div>
              <div className="text-sm text-slate-400">
                <p>Status: {health.status}</p>
              </div>
              <Button onClick={fetchHealth} variant="secondary">
                Refresh
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Home Assistant summary */}
      <Card>
        <CardHeader>
          <CardTitle>Smart Home</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {haLoading && states.length === 0 && <LoadingState />}
          {haError && (
            <ErrorState message={haError} onRetry={haRefresh} />
          )}
          {!haLoading && !haError && states.length === 0 && (
            <p className="text-sm text-slate-400">
              Home Assistant not connected. Set <code className="text-slate-300">HA_URL</code> and{" "}
              <code className="text-slate-300">HA_TOKEN</code> in your environment.
            </p>
          )}
          {states.length > 0 && (
            <>
              {/* Stats row */}
              <div className="flex gap-6 text-sm text-slate-400">
                <span>
                  <span className="text-slate-100 font-semibold">{states.length}</span>{" "}
                  entities
                </span>
                <span>
                  <span className="text-yellow-400 font-semibold">{lightsOn}</span>{" "}
                  {lightsOn === 1 ? "light" : "lights"} on
                </span>
              </div>

              {/* Quick controls grid */}
              {quickControls.length > 0 && (
                <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {quickControls.map((state) => (
                    <EntityCard
                      key={state.entity_id}
                      state={state}
                      onToggle={handleToggle}
                      pending={pending}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
