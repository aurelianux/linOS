import { Icon } from "@/components/ui/icon";
import { fetchJson } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { DashboardRoom, ModeState, QuickToggleConfig } from "@/lib/api/types";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { cn } from "@/lib/utils";
import { isLargeRoom } from "@/components/ha/roomHelpers";
import { mdiLightbulbOff } from "@mdi/js";
import { useCallback, useState } from "react";

export function buildQuickToggleRooms(quickToggles: QuickToggleConfig | undefined): Set<string> {
  if (!quickToggles) return new Set();
  return new Set(quickToggles.rooms.map((r) => r.roomId));
}

export function buildRoomLayout(rooms: DashboardRoom[]): Array<{ room: DashboardRoom; spanFull: boolean }> {
  return rooms.map((room) => ({ room, spanFull: isLargeRoom(room) }));
}

export function AllOffButton() {
  const { t } = useTranslation();
  const [busy, setBusy] = useState(false);

  const handleAllOff = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    try { await fetchJson<ModeState>(`${API_ENDPOINTS.MODE}/aus`, { method: "POST" }); }
    catch (err: unknown) { console.error("Failed to set all off:", err); }
    finally { setBusy(false); }
  }, [busy]);

  return (
    <button
      type="button"
      onClick={handleAllOff}
      disabled={busy}
      title={t("quickToggle.allOff")}
      aria-label={t("quickToggle.allOff")}
      className={cn("p-1 rounded transition-colors", "text-slate-400 hover:text-red-400 hover:bg-slate-800", "disabled:opacity-50 disabled:cursor-not-allowed")}
    >
      <Icon path={mdiLightbulbOff} size={0.75} />
    </button>
  );
}
