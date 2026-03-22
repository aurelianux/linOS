import { useState, useCallback, useEffect } from "react";
import { useEntity } from "@hakit/core";
import { useDashboardConfig } from "@/hooks/useDashboardConfig";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { cn } from "@/lib/utils";
import { useScrollSuppression } from "@/hooks/useScrollSuppression";
import type { QuickToggleConfig, DashboardRoom } from "@/lib/api/types";
import type { TranslationKey } from "@/lib/i18n/translations";

const MODE_STYLES: Record<string, { active: string; label: TranslationKey }> = {
  hell: { active: "bg-amber-400 text-slate-950", label: "quickToggle.mode.hell" },
  chill: { active: "bg-sky-400 text-slate-950", label: "quickToggle.mode.chill" },
  aus: { active: "bg-slate-600 text-slate-100", label: "quickToggle.mode.aus" },
};

interface RoomChipProps {
  room: DashboardRoom;
  selected: boolean;
  onToggle: () => void;
  suppressTaps: boolean;
}

function RoomChip({ room, selected, onToggle, suppressTaps }: RoomChipProps) {
  return (
    <button
      type="button"
      onClick={() => {
        if (!suppressTaps) onToggle();
      }}
      className={cn(
        "px-3 py-1.5 rounded-full text-sm font-medium transition-all duration-200",
        "border select-none",
        selected
          ? "bg-slate-100 text-slate-950 border-slate-100"
          : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200"
      )}
    >
      {room.name}
    </button>
  );
}

interface ModeButtonProps {
  mode: string;
  selected: boolean;
  onSelect: () => void;
  suppressTaps: boolean;
}

function ModeButton({ mode, selected, onSelect, suppressTaps }: ModeButtonProps) {
  const { t } = useTranslation();
  const style = MODE_STYLES[mode];
  const label = style ? t(style.label) : mode;

  return (
    <button
      type="button"
      onClick={() => {
        if (!suppressTaps) onSelect();
      }}
      className={cn(
        "flex-1 py-3 rounded-lg text-sm font-semibold transition-all duration-200",
        "border select-none",
        selected && style
          ? cn(style.active, "border-transparent shadow-sm")
          : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200"
      )}
    >
      {label}
    </button>
  );
}

interface ExecuteEntityProps {
  entityId: `input_select.${string}`;
  mode: string;
  onDone: () => void;
}

/**
 * Executes the mode selection for a single entity on mount.
 */
function ExecuteEntity({ entityId, mode, onDone }: ExecuteEntityProps) {
  const entity = useEntity(entityId, { returnNullIfNotFound: true });

  useEffect(() => {
    if (!entity || entity.state === "unavailable" || entity.state === "unknown") {
      onDone();
      return;
    }
    entity.service
      .selectOption({ serviceData: { option: mode } })
      .catch((err: unknown) => {
        console.error("Failed to set mode:", entityId, err);
      })
      .finally(onDone);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps -- run once on mount

  return null;
}

export function QuickAccessPanel() {
  const { t } = useTranslation();
  const { data: config } = useDashboardConfig();
  const suppressTaps = useScrollSuppression();

  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(new Set());
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [executing, setExecuting] = useState(false);
  const [pendingExecutions, setPendingExecutions] = useState<
    Array<{ entityId: `input_select.${string}`; mode: string }>
  >([]);

  const handleExecutionDone = useCallback(() => {
    setPendingExecutions((prev) => {
      const next = prev.slice(1);
      if (next.length === 0) {
        setExecuting(false);
      }
      return next;
    });
  }, []);

  const quickToggles = config?.quickToggles as QuickToggleConfig | undefined;
  const rooms = config?.rooms ?? [];

  if (!quickToggles) return null;

  const modes = quickToggles.modes;
  const roomToggleMap = new Map(
    quickToggles.rooms.map((r) => [r.roomId, r.entity])
  );

  const availableRooms = rooms.filter((r) => roomToggleMap.has(r.id));

  const handleRoomToggle = (roomId: string) => {
    setSelectedRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) {
        next.delete(roomId);
      } else {
        next.add(roomId);
      }
      return next;
    });
  };

  const handleModeSelect = (mode: string) => {
    setSelectedMode((prev) => (prev === mode ? null : mode));
  };

  const buildSummary = (): string => {
    if (selectedRoomIds.size === 0 || !selectedMode) {
      return t("quickToggle.noSelection");
    }
    const roomNames = availableRooms
      .filter((r) => selectedRoomIds.has(r.id))
      .map((r) => r.name);
    const modeStyle = MODE_STYLES[selectedMode];
    const modeLabel = modeStyle ? t(modeStyle.label) : selectedMode;
    return `${roomNames.join(" & ")} → ${modeLabel}`;
  };

  const canExecute = selectedRoomIds.size > 0 && selectedMode !== null;

  const handleExecute = () => {
    if (!canExecute || !selectedMode || executing) return;
    const executions = Array.from(selectedRoomIds)
      .map((roomId) => roomToggleMap.get(roomId))
      .filter((e): e is `input_select.${string}` => !!e)
      .map((entityId) => ({ entityId, mode: selectedMode }));

    setPendingExecutions(executions);
    setExecuting(true);
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-medium text-slate-400">
        {t("quickToggle.title")}
      </h3>

      {/* Room selection chips */}
      <div>
        <p className="text-xs text-slate-500 mb-1.5">{t("quickToggle.selectRooms")}</p>
        <div className="flex flex-wrap gap-2">
          {availableRooms.map((room) => (
            <RoomChip
              key={room.id}
              room={room}
              selected={selectedRoomIds.has(room.id)}
              onToggle={() => handleRoomToggle(room.id)}
              suppressTaps={suppressTaps}
            />
          ))}
        </div>
      </div>

      {/* Mode selection buttons */}
      <div>
        <p className="text-xs text-slate-500 mb-1.5">{t("quickToggle.selectMode")}</p>
        <div className="flex gap-2">
          {modes.map((mode) => (
            <ModeButton
              key={mode}
              mode={mode}
              selected={selectedMode === mode}
              onSelect={() => handleModeSelect(mode)}
              suppressTaps={suppressTaps}
            />
          ))}
        </div>
      </div>

      {/* Execute button */}
      <button
        type="button"
        disabled={!canExecute || executing}
        onClick={handleExecute}
        className={cn(
          "w-full py-3 rounded-lg text-sm font-semibold transition-all duration-200",
          "border select-none",
          canExecute && !executing
            ? "bg-amber-400 text-slate-950 border-amber-400 hover:bg-amber-300 active:bg-amber-500"
            : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
        )}
      >
        {executing ? "…" : buildSummary()}
      </button>

      {/* Hidden execution components */}
      {pendingExecutions.map((exec) => (
        <ExecuteEntity
          key={exec.entityId}
          entityId={exec.entityId}
          mode={exec.mode}
          onDone={handleExecutionDone}
        />
      ))}
    </div>
  );
}
