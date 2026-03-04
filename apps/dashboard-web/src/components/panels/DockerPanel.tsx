import { mdiDocker, mdiAlertCircleOutline } from "@mdi/js";
import Icon from "@mdi/react";
import { Panel } from "@/components/common/Panel";
import { LoadingState } from "@/components/common/LoadingState";
import { useDockerContainers } from "@/hooks/useDockerContainers";
import type { ContainerInfo } from "@/lib/api/types";

// ─── State dot ─────────────────────────────────────────────────────────────

const STATE_COLOR: Record<string, string> = {
  running: "bg-emerald-400",
  paused: "bg-amber-400",
  restarting: "bg-amber-400",
  exited: "bg-red-400",
  dead: "bg-red-400",
  created: "bg-slate-500",
};

function StateDot({ state }: { state: string }) {
  const color = STATE_COLOR[state] ?? "bg-slate-500";
  return (
    <span
      className={`h-2 w-2 rounded-full shrink-0 ${color}`}
      aria-hidden="true"
    />
  );
}

// ─── Container row ─────────────────────────────────────────────────────────

function ContainerRow({ container }: { container: ContainerInfo }) {
  return (
    <div className="flex items-center gap-3 py-2 border-b border-slate-800 last:border-0">
      <StateDot state={container.state} />
      <span
        className="text-sm font-medium text-slate-200 truncate min-w-0"
        title={container.name}
      >
        {container.name}
      </span>
      <span
        className="text-xs text-slate-500 truncate ml-auto shrink-0"
        title={container.image}
      >
        {container.image}
      </span>
      <span className="text-xs text-slate-400 shrink-0">{container.status}</span>
    </div>
  );
}

// ─── Docker unavailable notice ─────────────────────────────────────────────

function DockerUnavailableNotice({ reason }: { reason: string }) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2">
        <Icon
          path={mdiAlertCircleOutline}
          size={1}
          className="text-amber-400 shrink-0 mt-0.5"
        />
        <p className="text-sm text-amber-400">{reason}</p>
      </div>
      <p className="text-xs text-slate-500">
        To enable container listing, add the following volume to the
        dashboard-api service in{" "}
        <code className="bg-slate-800 px-1 rounded text-slate-300">
          docker-compose.yml
        </code>
        :
      </p>
      <pre className="text-xs bg-slate-800 text-slate-300 rounded px-3 py-2 overflow-x-auto">
        {"<HOST_DOCKER_SOCKET>:/var/run/docker.sock:ro"}
      </pre>
      <p className="text-xs text-slate-500">
        Replace{" "}
        <code className="bg-slate-800 px-1 rounded text-slate-300">
          {"<HOST_DOCKER_SOCKET>"}
        </code>{" "}
        with{" "}
        <code className="bg-slate-800 px-1 rounded text-slate-300">
          /var/run/docker.sock
        </code>{" "}
        on standard Linux hosts.
      </p>
    </div>
  );
}

// ─── Main component ────────────────────────────────────────────────────────

/**
 * Panel that lists running Docker containers from GET /api/system/containers.
 * Shows a helpful setup message when the Docker socket is not accessible.
 * Auto-refreshes every 30 seconds via useDockerContainers().
 */
export function DockerPanel() {
  const { data, loading, error, lastUpdated, refresh } = useDockerContainers();

  return (
    <Panel
      title="Docker Containers"
      onRefresh={refresh}
      loading={loading}
      lastUpdated={lastUpdated}
    >
      {loading && !data && <LoadingState />}

      {error && !data && (
        <div className="flex items-center gap-2">
          <Icon path={mdiDocker} size={1} className="text-red-400 shrink-0" />
          <p className="text-sm text-red-400">{error}</p>
        </div>
      )}

      {data && !data.available && (
        <DockerUnavailableNotice
          reason={data.unavailableReason ?? "Docker not available."}
        />
      )}

      {data?.available && data.containers.length === 0 && (
        <p className="text-sm text-slate-400">No running containers found.</p>
      )}

      {data?.available && data.containers.length > 0 && (
        <div>
          {data.containers.map((c) => (
            <ContainerRow key={c.id} container={c} />
          ))}
        </div>
      )}
    </Panel>
  );
}
