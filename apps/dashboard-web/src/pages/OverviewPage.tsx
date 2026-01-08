import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Button } from "../components/ui/button";
import { StatusBadge } from "../components/common/StatusBadge";
import { LoadingState } from "../components/common/LoadingState";
import { ErrorState } from "../components/common/ErrorState";
import { fetchJson, ApiErrorException } from "../lib/api/client";
import type { HealthResponse } from "../lib/api/types";

/**
 * Overview page - demonstrates API integration
 */
export function OverviewPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [health, setHealth] = useState<HealthResponse | null>(null);

  const fetchHealth = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchJson<HealthResponse>("/health");
      setHealth(data);
    } catch (err) {
      if (err instanceof ApiErrorException) {
        setError(err.message);
      } else {
        setError("Unknown error");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHealth();
  }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-3xl font-bold text-slate-100 mb-2">Overview</h2>
        <p className="text-slate-400">Welcome to linBoard v0.1</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>API Health</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading && <LoadingState />}
          {error && <ErrorState message={error} onRetry={fetchHealth} />}
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
    </div>
  );
}
