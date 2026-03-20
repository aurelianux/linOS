import { useState } from "react";
import { mdiHome, mdiChevronDown, mdiChevronUp } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { CardErrorBoundary } from "@/components/common/CardErrorBoundary";
import { getCardForDomain } from "./domainCards";
import { useTranslation } from "@/lib/i18n/useTranslation";

export interface RoomConfig {
  /** Display name of the room */
  name: string;
  /** Optional MDI icon path. Falls back to mdiHome. */
  icon?: string;
  /** Entity IDs assigned to this room */
  entityIds: string[];
}

interface RoomCardProps {
  room: RoomConfig;
  /** Whether the room starts expanded. Default: true */
  defaultExpanded?: boolean;
}

/**
 * Collapsible card for a single Home Assistant room / area.
 *
 * Shows:
 * - Room name + entity count in the header
 * - A responsive grid of entity cards inside, expanded by default
 * - Smooth expand/collapse via CSS transition on max-height
 *
 * Entity cards are picked automatically by domain via getCardForDomain().
 * Each card is wrapped in CardErrorBoundary.
 */
export function RoomCard({ room, defaultExpanded = true }: RoomCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  const { t } = useTranslation();

  const count = room.entityIds.length;
  const entityLabel = count === 1 ? t("rooms.entitySingular") : t("rooms.entityPlural");

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-900 overflow-hidden">
      {/* Header / toggle */}
      <button
        type="button"
        onClick={() => setExpanded((prev) => !prev)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-slate-800/50 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-400"
        aria-expanded={expanded}
      >
        <div className="flex items-center gap-2">
          <Icon
            path={room.icon ?? mdiHome}
            size={1}
            className="text-slate-400 shrink-0"
          />
          <span className="text-base font-semibold text-slate-100">
            {room.name}
          </span>
          <span className="text-xs text-slate-500">
            ({count} {entityLabel})
          </span>
        </div>
        <Icon
          path={expanded ? mdiChevronUp : mdiChevronDown}
          size={0.9}
          className="text-slate-400 shrink-0"
        />
      </button>

      {/* Collapsible content */}
      <div
        className={cn(
          "overflow-hidden transition-all duration-300 ease-in-out",
          expanded ? "max-h-[2000px] opacity-100" : "max-h-0 opacity-0"
        )}
      >
        {count === 0 ? (
          <p className="px-4 pb-4 text-sm text-slate-500">
            {t("rooms.noEntities")}
          </p>
        ) : (
          <div className="px-4 pb-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {room.entityIds.map((entityId) => {
              const domain = entityId.split(".")[0] ?? "";
              const EntityCard = getCardForDomain(domain);
              return (
                <CardErrorBoundary key={entityId} entityId={entityId}>
                  <EntityCard entityId={entityId} />
                </CardErrorBoundary>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
