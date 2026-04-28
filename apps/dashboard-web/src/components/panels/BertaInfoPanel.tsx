import { mdiDesktopTower } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { CollapsiblePanel } from "@/components/common/CollapsiblePanel";
import { LoadingState } from "@/components/common/LoadingState";
import { useBertaMetrics } from "@/hooks/useBertaMetrics";
import type { BertaMetrics, GpuMetrics } from "@/lib/api/types";

// ─── Formatters ─────────────────────────────────────────────────────────────

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);

  const parts: string[] = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  if (m > 0 || parts.length === 0) parts.push(`${m}m`);

  return parts.join(" ");
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) {
    return `${(bytes / 1_073_741_824).toFixed(1)} GB`;
  }
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toFixed(1)} MB`;
  }
  return `${(bytes / 1024).toFixed(1)} KB`;
}

function formatMiB(mib: number): string {
  if (mib >= 1024) {
    return `${(mib / 1024).toFixed(1)} GB`;
  }
  return `${mib} MB`;
}

// ─── Info row ────────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-slate-800 last:border-0">
      <span className="text-sm text-slate-400 shrink-0">{label}</span>
      <span className="text-sm font-medium text-slate-100 text-right tabular-nums">
        {value}
      </span>
    </div>
  );
}

// ─── GPU section ─────────────────────────────────────────────────────────────

function GpuSection({ gpu }: { gpu: GpuMetrics }) {
  return (
    <>
      <InfoRow label="GPU" value={gpu.name} />
      <InfoRow label="GPU Load" value={`${gpu.utilizationPercent}%`} />
      <InfoRow
        label="GPU Memory"
        value={`${formatMiB(gpu.memoryUsedMiB)} / ${formatMiB(gpu.memoryTotalMiB)}`}
      />
    </>
  );
}

// ─── Panel body ──────────────────────────────────────────────────────────────

function BertaInfoBody({ metrics }: { metrics: BertaMetrics }) {
  const usedMemory = metrics.totalMemoryBytes - metrics.freeMemoryBytes;

  return (
    <div>
      <InfoRow label="Host" value={metrics.hostname} />
      <InfoRow label="Uptime" value={formatUptime(metrics.uptimeSeconds)} />
      <InfoRow label="CPU" value={`${metrics.cpuLoadPercent}%`} />
      <InfoRow
        label="RAM"
        value={`${formatBytes(usedMemory)} / ${formatBytes(metrics.totalMemoryBytes)}`}
      />
      {metrics.gpu !== null ? (
        <GpuSection gpu={metrics.gpu} />
      ) : (
        <InfoRow label="GPU" value="Not available" />
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function BertaInfoPanel() {
  const { data, loading, error, lastUpdated, refresh } = useBertaMetrics();

  return (
    <CollapsiblePanel
      panelKey="berta-info"
      icon={mdiDesktopTower}
      title="Berta"
      onRefresh={refresh}
      loading={loading}
      lastUpdated={lastUpdated}
    >
      {loading && !data && <LoadingState />}

      {error && !data && (
        <div className="flex items-center gap-2">
          <Icon path={mdiDesktopTower} size={1} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {data && !data.available && (
        <div className="flex items-center gap-2">
          <Icon path={mdiDesktopTower} size={1} className="text-slate-500 shrink-0" />
          <p className="text-sm text-slate-500">
            {data.unavailableReason ?? "Berta agent unavailable"}
          </p>
        </div>
      )}

      {data?.available && data.metrics !== null && (
        <BertaInfoBody metrics={data.metrics} />
      )}
    </CollapsiblePanel>
  );
}
