import { ToggleChip } from "@/components/ui/toggle-chip";
import { useScrollSuppression } from "@/hooks/useScrollSuppression";
import { useLightingModes } from "@/hooks/useLightingModes";
import type { DashboardConfig, QuickToggleConfig } from "@/lib/api/types";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useMemo, useState } from "react";
import { MODE_CONFIG, ModeButton, useQuickAccessPanelActions } from "./QuickAccessPanel.helpers";

interface QuickAccessPanelProps {
  config: DashboardConfig;
}

export function QuickAccessPanel({ config }: QuickAccessPanelProps) {
  const { t } = useTranslation();
  const suppressTaps = useScrollSuppression();
  const { data: modeState } = useLightingModes();

  const [userSelectedRoomIds, setUserSelectedRoomIds] = useState<Set<string> | null>(null);

  const quickToggles = config.quickToggles as QuickToggleConfig | undefined;
  const rooms = config.rooms;

  const toggleRoomIds = useMemo(() => new Set(quickToggles?.rooms.map((r) => r.roomId) ?? []), [quickToggles]);
  const availableRooms = useMemo(() => rooms.filter((r) => toggleRoomIds.has(r.id)), [rooms, toggleRoomIds]);
  const defaultRoomIds = useMemo(() => {
    const hasWohnzimmer = availableRooms.some((r) => r.id === "wohnzimmer");
    return hasWohnzimmer ? new Set(["wohnzimmer"]) : new Set<string>();
  }, [availableRooms]);

  const selectedRoomIds = userSelectedRoomIds ?? defaultRoomIds;
  const allSelected = availableRooms.length > 0 && availableRooms.every((r) => selectedRoomIds.has(r.id));
  const firstSelectedRoomId = Array.from(selectedRoomIds)[0];
  const currentRoomMode = firstSelectedRoomId ? (modeState?.[firstSelectedRoomId] ?? undefined) : undefined;
  const modes = quickToggles?.modes ?? [];

  const { buttonStates, handleModePointerDown, cancelLongPress, handleModeClick } =
    useQuickAccessPanelActions(selectedRoomIds, allSelected, suppressTaps);

  const handleSelectAll = () => {
    setUserSelectedRoomIds(allSelected ? new Set() : new Set(availableRooms.map((r) => r.id)));
  };

  const handleRoomToggle = (roomId: string) => {
    setUserSelectedRoomIds((prev) => {
      const next = new Set(prev);
      if (next.has(roomId)) next.delete(roomId); else next.add(roomId);
      return next;
    });
  };

  if (!quickToggles) return null;

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs text-slate-500 mb-1.5">{t("quickToggle.selectRooms")}</p>
        <div className="flex flex-wrap gap-2">
          <ToggleChip label={t("quickToggle.allRooms")} selected={allSelected} onClick={() => { if (!suppressTaps) handleSelectAll(); }} />
          {availableRooms.map((room) => (
            <ToggleChip key={room.id} label={room.name} selected={selectedRoomIds.has(room.id)} onClick={() => { if (!suppressTaps) handleRoomToggle(room.id); }} />
          ))}
        </div>
      </div>
      <div>
        <p className="text-xs text-slate-500 mb-1.5">{t("quickToggle.selectMode")}</p>
        <div className="flex gap-2">
          {modes.filter((m) => MODE_CONFIG[m]).map((mode) => (
            <ModeButton
              key={mode}
              mode={mode}
              isCurrent={currentRoomMode === mode}
              btnState={buttonStates[mode] ?? "idle"}
              isDisabled={selectedRoomIds.size === 0 || buttonStates[mode] === "executing"}
              onPointerDown={() => handleModePointerDown(mode)}
              onPointerUp={cancelLongPress}
              onPointerLeave={cancelLongPress}
              onClick={() => handleModeClick(mode)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
