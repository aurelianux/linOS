import { Icon } from "@/components/ui/icon";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useOptimisticAction } from "@/hooks/useOptimisticAction";
import { useLightingModes } from "@/hooks/useLightingModes";
import { fetchJson } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { ModeState } from "@/lib/api/types";
import type { TranslationKey } from "@/lib/i18n/translations";
import {
  mdiBrightness7,
  mdiBrightness4,
  mdiWeatherNight,
  mdiLightbulbOff,
} from "@mdi/js";

const MODE_CONFIG: Record<
  string,
  { labelKey: TranslationKey; icon: string; activeBg: string; activeText: string }
> = {
  hell: {
    labelKey: "quickToggle.mode.hell",
    icon: mdiBrightness7,
    activeBg: "bg-amber-400",
    activeText: "text-slate-950",
  },
  chill: {
    labelKey: "quickToggle.mode.chill",
    icon: mdiBrightness4,
    activeBg: "bg-sky-400",
    activeText: "text-slate-950",
  },
  dunkel: {
    labelKey: "quickToggle.mode.dunkel",
    icon: mdiWeatherNight,
    activeBg: "bg-violet-400",
    activeText: "text-slate-950",
  },
  aus: {
    labelKey: "quickToggle.mode.aus",
    icon: mdiLightbulbOff,
    activeBg: "bg-slate-600",
    activeText: "text-slate-100",
  },
};

interface QuickToggleProps {
  scope: "all" | { room: string };
  label: string;
  modes?: string[];
}

export function QuickToggle({
  scope,
  label,
  modes = ["hell", "chill", "dunkel", "aus"],
}: QuickToggleProps) {
  const { t } = useTranslation();
  const { data: modeState } = useLightingModes();
  const { optimisticValue: optimisticMode, execute } = useOptimisticAction<string>();

  const roomId = scope === "all" ? null : scope.room;
  const serverMode = roomId !== null ? (modeState?.[roomId] ?? null) : null;
  const currentMode = optimisticMode ?? serverMode ?? "";

  const handleModeSelect = (mode: string) => {
    if (currentMode === mode) return;
    const path =
      scope === "all"
        ? `${API_ENDPOINTS.MODE}/${mode}`
        : `${API_ENDPOINTS.MODE}/${mode}/${scope.room}`;

    execute(mode, () =>
      fetchJson<ModeState>(path, { method: "POST" }).then(() => undefined)
    );
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-slate-500 shrink-0 min-w-0 truncate">
        {label}
      </span>
      <div className="flex rounded-full bg-slate-800 p-0.5">
        {modes.map((mode) => {
          const isActive = currentMode === mode;
          const cfg = MODE_CONFIG[mode];
          if (!cfg) return null;

          return (
            <button
              key={mode}
              type="button"
              onClick={() => handleModeSelect(mode)}
              title={t(cfg.labelKey)}
              className={cn(
                "px-2.5 py-1 rounded-full",
                "transition-all duration-200",
                isActive
                  ? cn(cfg.activeBg, cfg.activeText, "shadow-sm")
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              <Icon path={cfg.icon} size={0.7} />
            </button>
          );
        })}
      </div>
    </div>
  );
}
