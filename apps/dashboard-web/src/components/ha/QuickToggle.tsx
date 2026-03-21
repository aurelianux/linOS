import { useEntity } from "@hakit/core";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useOptimisticAction } from "@/hooks/useOptimisticAction";
import type { TranslationKey } from "@/lib/i18n/translations";

const MODE_COLORS: Record<string, { bg: string; text: string }> = {
  hell: { bg: "bg-amber-400", text: "text-slate-950" },
  chill: { bg: "bg-sky-400", text: "text-slate-950" },
  aus: { bg: "bg-slate-600", text: "text-slate-100" },
};

interface QuickToggleProps {
  entityId: `input_select.${string}`;
  label: string;
  modes?: string[];
}

export function QuickToggle({
  entityId,
  label,
  modes = ["hell", "chill", "aus"],
}: QuickToggleProps) {
  const entity = useEntity(entityId, { returnNullIfNotFound: true });
  const { t } = useTranslation();
  const {
    optimisticValue: optimisticMode,
    execute,
  } = useOptimisticAction<string>();

  const isUnavailable =
    !entity ||
    entity.state === "unavailable" ||
    entity.state === "unknown";

  const currentMode = optimisticMode ?? entity?.state ?? "";

  const handleModeSelect = (mode: string) => {
    if (isUnavailable || !entity || currentMode === mode) return;
    execute(mode, async () => {
      await entity.service.selectOption({
        serviceData: { option: mode },
      });
    });
  };

  return (
    <div className={cn("flex items-center gap-3", isUnavailable && "opacity-50")}>
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
              disabled={isUnavailable}
              onClick={() => handleModeSelect(mode)}
              className={cn(
                "px-3 py-1 rounded-full text-xs font-medium",
                "transition-all duration-200",
                "disabled:cursor-not-allowed",
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
