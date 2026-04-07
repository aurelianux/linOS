import { useMemo } from "react";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { AutomationCard } from "@/components/ha/AutomationCard";
import { CardErrorBoundary } from "@/components/common/CardErrorBoundary";
import { CollapsiblePanel } from "@/components/common/CollapsiblePanel";
import { Icon } from "@/components/ui/icon";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { resolveDashboardIcon } from "@/lib/ha/dashboardIcons";
import type { AutomationGroup } from "@/lib/api/types";
import { mdiRobotHappy } from "@mdi/js";

/**
 * Renders a single group of automations as a collapsible sub-section.
 * Each group has its own icon, title, and grid of AutomationCards.
 */
function AutomationGroupSection({ group }: { group: AutomationGroup }) {
  const iconPath = resolveDashboardIcon(group.icon);

  return (
    <div className="space-y-2">
      {/* Group header */}
      <div className="flex items-center gap-2">
        <Icon path={iconPath} size={0.7} className="text-slate-400 shrink-0" />
        <span className="text-xs font-medium text-slate-400 uppercase tracking-wide">
          {group.label}
        </span>
      </div>

      {/* Automation cards grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
        {group.entities.map((entry) => (
          <CardErrorBoundary key={entry.entityId} entityId={entry.entityId}>
            <AutomationCard entityId={entry.entityId} />
          </CardErrorBoundary>
        ))}
      </div>
    </div>
  );
}

/**
 * Automations Panel — the "Control Plane" for HA automations.
 *
 * HA is the execution engine (automations live as YAML/UI in HA).
 * This panel provides a dashboard surface to:
 * - See which automations are active
 * - Toggle automations on/off
 * - See when each automation last fired
 * - Manually trigger automations
 *
 * Config comes from `dashboard.json → automations.groups[]`.
 */
export function AutomationsPanel() {
  const { t } = useTranslation();
  const { data: dashConfig } = useDashboardConfig();

  const groups = useMemo<AutomationGroup[]>(
    () => dashConfig?.automations?.groups ?? [],
    [dashConfig?.automations?.groups]
  );

  if (groups.length === 0) return null;

  const totalEntities = groups.reduce(
    (sum, g) => sum + g.entities.length,
    0
  );

  // Don't render if no automation entities are configured at all
  if (totalEntities === 0) return null;

  return (
    <CollapsiblePanel
      panelKey="automations"
      icon={mdiRobotHappy}
      title={t("automations.title")}
      defaultCollapsed
    >
      <div className="space-y-4">
        {groups.map((group) => (
          <AutomationGroupSection key={group.id} group={group} />
        ))}
      </div>
    </CollapsiblePanel>
  );
}
