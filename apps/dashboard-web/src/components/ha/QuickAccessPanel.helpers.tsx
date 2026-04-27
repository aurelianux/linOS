import { Icon } from "@/components/ui/icon";
import { fetchJson } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { ModeState } from "@/lib/api/types";
import type { TranslationKey } from "@/lib/i18n/translations";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { cn } from "@/lib/utils";
import {
  mdiBrightness7, mdiBrightness4, mdiWeatherNight, mdiLightbulbOff, mdiCheck, mdiAlertCircle,
} from "@mdi/js";
import { useCallback, useRef, useState } from "react";

export const MODE_CONFIG: Record<string, { labelKey: TranslationKey; icon: string; activeClass: string }> = {
  hell: { labelKey: "quickToggle.mode.hell", icon: mdiBrightness7, activeClass: "bg-amber-400 text-slate-950 border-transparent shadow-sm ring-1 ring-white/20" },
  chill: { labelKey: "quickToggle.mode.chill", icon: mdiBrightness4, activeClass: "bg-sky-400 text-slate-950 border-transparent shadow-sm ring-1 ring-white/20" },
  dunkel: { labelKey: "quickToggle.mode.dunkel", icon: mdiWeatherNight, activeClass: "bg-violet-400 text-slate-950 border-transparent shadow-sm ring-1 ring-white/20" },
  aus: { labelKey: "quickToggle.mode.aus", icon: mdiLightbulbOff, activeClass: "bg-slate-600 text-slate-100 border-transparent shadow-sm ring-1 ring-white/20" },
};

export const LONG_PRESS_DURATION_MS = 600;
export const SUCCESS_DISPLAY_DURATION_MS = 1200;
export const ERROR_DISPLAY_DURATION_MS = 1500;

export type ButtonState = "idle" | "executing" | "success" | "error";

export function useQuickAccessPanelActions(
  selectedRoomIds: Set<string>,
  allSelected: boolean,
  suppressTaps: boolean
) {
  const [buttonStates, setButtonStates] = useState<Record<string, ButtonState>>({});
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressTriggeredRef = useRef(false);

  const applyMode = useCallback(async (mode: string) => {
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
      setTimeout(() => setButtonStates((prev) => ({ ...prev, [mode]: "idle" })), SUCCESS_DISPLAY_DURATION_MS);
    } catch (err: unknown) {
      console.error("Failed to apply lighting mode:", err);
      setButtonStates((prev) => ({ ...prev, [mode]: "error" }));
      setTimeout(() => setButtonStates((prev) => ({ ...prev, [mode]: "idle" })), ERROR_DISPLAY_DURATION_MS);
    }
  }, [selectedRoomIds, allSelected]);

  const handleModePointerDown = useCallback((mode: string) => {
    longPressTriggeredRef.current = false;
    longPressTimerRef.current = setTimeout(() => { longPressTriggeredRef.current = true; void applyMode(mode); }, LONG_PRESS_DURATION_MS);
  }, [applyMode]);

  const cancelLongPress = useCallback(() => {
    if (longPressTimerRef.current) { clearTimeout(longPressTimerRef.current); longPressTimerRef.current = null; }
  }, []);

  const handleModeClick = useCallback((mode: string) => {
    if (suppressTaps || longPressTriggeredRef.current) return;
    void applyMode(mode);
  }, [suppressTaps, applyMode]);

  return { buttonStates, handleModePointerDown, cancelLongPress, handleModeClick };
}

interface ModeButtonProps {
  mode: string;
  isCurrent: boolean;
  btnState: ButtonState;
  isDisabled: boolean;
  onPointerDown: () => void;
  onPointerUp: () => void;
  onPointerLeave: () => void;
  onClick: () => void;
}

export function ModeButton({ mode, isCurrent, btnState, isDisabled, onPointerDown, onPointerUp, onPointerLeave, onClick }: ModeButtonProps) {
  const { t } = useTranslation();
  const cfg = MODE_CONFIG[mode];
  if (!cfg) return null;
  const isExecuting = btnState === "executing";
  const isSuccess = btnState === "success";
  const isError = btnState === "error";
  const iconPath = isSuccess ? mdiCheck : isError ? mdiAlertCircle : cfg.icon;

  return (
    <button
      type="button"
      disabled={isDisabled}
      onPointerDown={onPointerDown}
      onPointerUp={onPointerUp}
      onPointerLeave={onPointerLeave}
      onClick={onClick}
      title={t(cfg.labelKey)}
      className={cn(
        "flex-1 py-3 rounded-lg flex flex-col items-center gap-1.5",
        "border select-none transition-all duration-200 active:scale-95",
        isError ? "bg-red-500/20 border-red-500 text-red-400"
          : isSuccess ? "bg-emerald-500/20 border-emerald-500 text-emerald-400"
          : isCurrent ? cfg.activeClass
          : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200"
      )}
    >
      <Icon path={iconPath} size={0.9} className={cn("transition-all duration-200", isExecuting && "animate-pulse", (isSuccess || isError) && "animate-scale-in")} />
      <span className="text-xs font-medium">{t(cfg.labelKey)}</span>
    </button>
  );
}
