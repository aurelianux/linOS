import { mdiServer } from "@mdi/js";
import Icon from "@mdi/react";
import { Panel } from "@/components/common/Panel";
import { LoadingState } from "@/components/common/LoadingState";
import { useSystemInfo } from "@/hooks/useSystemInfo";
import type { SystemInfo } from "@/lib/api/types";

// ─── Formatters ────────────────────────────────────────────────────────────

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

// ─── Info row ──────────────────────────────────────────────────────────────

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-2 border-b border-slate-800 last:border-0">
      <span className="text-sm text-slate-400 shrink-0">{label}</span>
      <span className="text-sm font-medium text-slate-100 text-right tabular-nums">
        {value}
      </span>
    </div>
  );
}

// ─── Panel body ────────────────────────────────────────────────────────────

function SystemInfoBody({ info }: { info: SystemInfo }) {
  const usedMemory = info.totalMemoryBytes - info.freeMemoryBytes;

  const diskValue =
    info.diskTotalBytes !== null && info.diskUsedBytes !== null
      ? `${formatBytes(info.diskUsedBytes)} / ${formatBytes(info.diskTotalBytes)}`
      : "–";

  return (
    <div>
      <InfoRow label="Host" value={info.hostname} />
      <InfoRow label="Uptime" value={formatUptime(info.uptimeSeconds)} />
      <InfoRow label="OS" value={info.platform} />
      <InfoRow label="Arch" value={info.arch} />
      <InfoRow label="CPU" value={`${info.cpuLoadPercent}%`} />
      <InfoRow
        label="RAM"
        value={`${formatBytes(usedMemory)} / ${formatBytes(info.totalMemoryBytes)}`}
      />
      <InfoRow label="Disk" value={diskValue} />
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

/**
 * Panel that displays host system metrics from GET /api/system/info.
 * Auto-refreshes every 30 seconds via useSystemInfo().
 */
export function SystemInfoPanel() {
  const { data, loading, error, lastUpdated, refresh } = useSystemInfo();

  return (
    <Panel
      title="System Info"
      onRefresh={refresh}
      loading={loading}
      lastUpdated={lastUpdated}
    >
      {loading && !data && <LoadingState />}

      {error && !data && (
        <div className="flex items-center gap-2">
          <Icon path={mdiServer} size={1} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {data && <SystemInfoBody info={data} />}
    </Panel>
  );
}
