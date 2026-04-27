import { Icon } from "@/components/ui/icon";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { useScrollSuppression } from "@/hooks/useScrollSuppression";
import { useLightingModes } from "@/hooks/useLightingModes";
import { fetchJson } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { DashboardConfig, ModeState, QuickToggleConfig } from "@/lib/api/types";
import type { TranslationKey } from "@/lib/i18n/translations";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { cn } from "@/lib/utils";
import {
  mdiBrightness7,
  mdiBrightness4,
  mdiWeatherNight,
  mdiLightbulbOff,
  mdiCheck,
  mdiAlertCircle,
} from "@mdi/js";
import { useCallback, useMemo, useRef, useState } from "react";

const MODE_CONFIG: Record<
  string,
  { labelKey: TranslationKey; icon: string; activeClass: string }
> = {
  hell: {
    labelKey: "quickToggle.mode.hell",
    icon: mdiBrightness7,
    activeClass: "bg-amber-400 text-slate-950 border-transparent shadow-sm ring-1 ring-white/20",
  },
  chill: {
    labelKey: "quickToggle.mode.chill",
    icon: mdiBrightness4,
    activeClass: "bg-sky-400 text-slate-950 border-transparent shadow-sm ring-1 ring-white/20",
  },
  dunkel: {
    labelKey: "quickToggle.mode.dunkel",
    icon: mdiWeatherNight,
    activeClass: "bg-violet-400 text-slate-950 border-transparent shadow-sm ring-1 ring-white/20",
  },
  aus: {
    labelKey: "quickToggle.mode.aus",
    icon: mdiLightbulbOff,
    activeClass: "bg-slate-600 text-slate-100 border-transparent shadow-sm ring-1 ring-white/20",
  },
};

type ButtonState = "idle" | "executing" | "success" | "error";

interface QuickAccessPanelProps {
  config: DashboardConfig;
}

export function QuickAccessPanel({ config }: QuickAccessPanelProps) {
  const { t } = useTranslation();
  const suppressTaps = useScrollSuppression();
  const { data: modeState } = useLightingModes();

  const [userSelectedRoomIds, setUserSelectedRoomIds] = useState<Set<string> | null>(null);
  const [buttonStates, setButtonStates] = useState<Record<string, ButtonState>>({});
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const quickToggles = config.quickToggles as QuickToggleConfig | undefined;
  const rooms = config.rooms;

  const toggleRoomIds = useMemo(
    () => new Set(quickToggles?.rooms.map((r) => r.roomId) ?? []),
    [quickToggles]
  );

  const availableRooms = useMemo(
    () => rooms.filter((r) => toggleRoomIds.has(r.id)),
    [rooms, toggleRoomIds]
  );

  const defaultRoomIds = useMemo(() => {
    const hasWohnzimmer = availableRooms.some((r) => r.id === "wohnzimmer");
    return hasWohnzimmer ? new Set(["wohnzimmer"]) : new Set<string>();
  }, [availableRooms]);

  const selectedRoomIds = userSelectedRoomIds ?? defaultRoomIds;
  const setSelectedRoomIds = setUserSelectedRoomIds;

  const firstSelectedRoomId = Array.from(selectedRoomIds)[0];
  const currentRoomMode = firstSelectedRoomId ? (modeState?.[firstSelectedRoomId] ?? undefined) : undefined;

  const modes = quickToggles?.modes ?? [];
  const allSelected = availableRooms.length > 0 && availableRooms.every((r) => selectedRoomIds.has(r.id));

  const handleSelectAll = () => {
    setSelectedRoomIds(allSelected ? new Set() : new Set(availableRooms.map((r) => r.id)));
  };

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

  const applyMode = useCallback(
    async (mode: string) => {
      if (selectedRoomIds.size === 0) return;
      setButtonStates((prev) => ({ ...prev, [mode]: "executing" }));
      try {
        if (allSelected) {
          await fetchJson<ModeState>(`${API_ENDPOINTS.MODE}/${mode}`, { method: "POST" });
        } else {
          await Promise.all(
            Array.from(selectedRoomIds).map((roomId) =>
              fetchJson<ModeState>(`${API_ENDPOINTS.MODE}/${mode}/${roomId}`, { method: "POST" })
            )
          );
        }
        setButtonStates((prev) => ({ ...prev, [mode]: "success" }));
        setTimeout(() => setButtonStates((prev) => ({ ...prev, [mode]: "idle" })), 1200);
      } catch (err: unknown) {
        console.error("Failed to apply lighting mode:", err);
        setButtonStates((prev) => ({ ...prev, [mode]: "error" }));
        setTimeout(() => setButtonStates((prev) => ({ ...prev, [mode]: "idle" })), 1500);
      }
    },
    [selectedRoomIds, allSelected]
  );

  const handleModePointerDown = useCallback(
    (mode: string) => {
      longPressTriggeredRef.current = false;
      longPressTimerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true;
        void applyMode(mode);
      }, 600);
    },
    [applyMode]
  );

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleModeClick = useCallback(
    (mode: string) => {
      if (suppressTaps || longPressTriggeredRef.current) return;
      void applyMode(mode);
    },
    [suppressTaps, applyMode]
  );

  if (!quickToggles) return null;

  return (
    <div className="space-y-3">
      {/* Room selection chips */}
      <div>
        <p className="text-xs text-slate-500 mb-1.5">{t("quickToggle.selectRooms")}</p>
        <div className="flex flex-wrap gap-2">
          <ToggleChip
            label={t("quickToggle.allRooms")}
            selected={allSelected}
            onClick={() => {
              if (!suppressTaps) handleSelectAll();
            }}
          />
          {availableRooms.map((room) => (
            <ToggleChip
              key={room.id}
              label={room.name}
              selected={selectedRoomIds.has(room.id)}
              onClick={() => {
                if (!suppressTaps) handleRoomToggle(room.id);
              }}
            />
          ))}
        </div>
      </div>

      {/* Mode icon buttons */}
      <div>
        <p className="text-xs text-slate-500 mb-1.5">{t("quickToggle.selectMode")}</p>
        <div className="flex gap-2">
          {modes.map((mode) => {
            const cfg = MODE_CONFIG[mode];
            if (!cfg) return null;
            const btnState = buttonStates[mode] ?? "idle";
            const isCurrent = currentRoomMode === mode;
            const isExecuting = btnState === "executing";
            const isSuccess = btnState === "success";
            const isError = btnState === "error";
            const isDisabled = selectedRoomIds.size === 0 || isExecuting;
            const iconPath = isSuccess ? mdiCheck : isError ? mdiAlertCircle : cfg.icon;

            return (
              <button
                key={mode}
                type="button"
                disabled={isDisabled}
                onPointerDown={() => handleModePointerDown(mode)}
                onPointerUp={cancelLongPress}
                onPointerLeave={cancelLongPress}
                onClick={() => handleModeClick(mode)}
                title={t(cfg.labelKey)}
                className={cn(
                  "flex-1 py-3 rounded-lg flex flex-col items-center gap-1.5",
                  "border select-none transition-all duration-200 active:scale-95",
                  isError
                    ? "bg-red-500/20 border-red-500 text-red-400"
                    : isSuccess
                      ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
                      : isCurrent
                        ? cfg.activeClass
                        : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200"
                )}
              >
                <Icon
                  path={iconPath}
                  size={0.9}
                  className={cn(
                    "transition-all duration-200",
                    isExecuting && "animate-pulse",
                    (isSuccess || isError) && "animate-scale-in"
                  )}
                />
                <span className="text-xs font-medium">{t(cfg.labelKey)}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
