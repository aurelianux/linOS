import { useMemo } from "react";
import { useHaStates, useHaService } from "../hooks/useHomeAssistant";
import { EntityCard } from "../components/ha/EntityCard";
import { LoadingState } from "../components/common/LoadingState";
import { ErrorState } from "../components/common/ErrorState";
import { EmptyState } from "../components/common/EmptyState";
import { entityDomain } from "../lib/api/types";

/** Human-readable section labels per domain */
const DOMAIN_LABELS: Record<string, string> = {
  light: "Lights",
  switch: "Switches",
  sensor: "Sensors",
  binary_sensor: "Binary Sensors",
  climate: "Climate",
  fan: "Fans",
  input_boolean: "Input Booleans",
  automation: "Automations",
  media_player: "Media Players",
};

/** Domains shown in the Rooms page (noisy/system domains are hidden) */
const VISIBLE_DOMAINS = new Set(Object.keys(DOMAIN_LABELS));

/**
 * Rooms page – displays Home Assistant entities grouped by domain.
 */
export function RoomsPage() {
  const { states, loading, error, refresh } = useHaStates();
  const { callService, pending } = useHaService();

  /** Filter to known domains and group by domain */
  const groups = useMemo(() => {
    const filtered = states.filter((s) =>
      VISIBLE_DOMAINS.has(entityDomain(s.entity_id))
    );
    const map = new Map<string, typeof filtered>();
    for (const state of filtered) {
      const domain = entityDomain(state.entity_id);
      const group = map.get(domain) ?? [];
      group.push(state);
      map.set(domain, group);
    }
    // Sort groups by label alphabetically
    return [...map.entries()].sort(([a], [b]) =>
      (DOMAIN_LABELS[a] ?? a).localeCompare(DOMAIN_LABELS[b] ?? b)
    );
  }, [states]);

  async function handleToggle(entityId: string, currentState: string) {
    const domain = entityDomain(entityId);
    const service = currentState === "on" ? "turn_off" : "turn_on";
    await callService(domain, service, { entity_id: entityId });
    // Optimistically refresh after a short delay
    setTimeout(refresh, 800);
  }

  return (
    <div className="p-6 space-y-8">
      <div>
        <h2 className="text-3xl font-bold text-slate-100 mb-2">Rooms</h2>
        <p className="text-slate-400">
          Control your Home Assistant devices
        </p>
      </div>

      {loading && states.length === 0 && <LoadingState />}
      {error && <ErrorState message={error} onRetry={refresh} />}

      {!loading && !error && groups.length === 0 && (
        <EmptyState message="No Home Assistant entities found. Make sure HA_URL and HA_TOKEN are configured." />
      )}

      {groups.map(([domain, entities]) => (
        <section key={domain}>
          <h3 className="text-lg font-semibold text-slate-300 mb-3">
            {DOMAIN_LABELS[domain] ?? domain}
            <span className="ml-2 text-sm font-normal text-slate-500">
              ({entities.length})
            </span>
          </h3>
          <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {entities.map((state) => (
              <EntityCard
                key={state.entity_id}
                state={state}
                onToggle={handleToggle}
                pending={pending}
              />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
