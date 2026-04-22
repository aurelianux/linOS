import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useOptimisticAction } from "@/hooks/useOptimisticAction";
import { useLightingModes } from "@/hooks/useLightingModes";
import { fetchJson } from "@/lib/api/client";
import { API_ENDPOINTS } from "@/lib/api/endpoints";
import type { ModeState } from "@/lib/api/types";
import type { TranslationKey } from "@/lib/i18n/translations";

const MODE_COLORS: Record<string, { bg: string; text: string }> = {
  hell: { bg: "bg-amber-400", text: "text-slate-950" },
  chill: { bg: "bg-sky-400", text: "text-slate-950" },
  aus: { bg: "bg-slate-600", text: "text-slate-100" },
};

interface QuickToggleProps {
  scope: "all" | { room: string };
  label: string;
  modes?: string[];
}

export function QuickToggle({
  scope,
  label,
  modes = ["hell", "chill", "aus"],
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
          const colors = MODE_COLORS[mode];
          const translationKey = `quickToggle.mode.${mode}` as TranslationKey;

          return (
            <button
              key={mode}
              type="button"
              onClick={() => handleModeSelect(mode)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium",
                "transition-all duration-200",
                isActive && colors
                  ? cn(colors.bg, colors.text, "shadow-sm")
                  : "text-slate-400 hover:text-slate-200"
              )}
            >
              {t(translationKey)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
