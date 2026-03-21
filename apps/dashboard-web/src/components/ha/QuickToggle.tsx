import { useEntity } from "@hakit/core";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { useOptimisticAction } from "@/hooks/useOptimisticAction";
import { InlineError } from "@/components/common/InlineError";
import type { TranslationKey } from "@/lib/i18n/translations";

const MODE_STYLES: Record<string, { active: string; border: string }> = {
  hell: {
    active: "bg-amber-400 text-slate-950",
    border: "border-amber-900/50",
  },
  chill: {
    active: "bg-sky-400 text-slate-950",
    border: "border-sky-900/50",
  },
  aus: {
    active: "bg-slate-600 text-slate-100",
    border: "border-slate-700",
  },
};

const INACTIVE_STYLE = "bg-slate-800 text-slate-400 hover:bg-slate-700";

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
    error,
    clearError,
  } = useOptimisticAction<string>();

  const isUnavailable =
    !entity ||
    entity.state === "unavailable" ||
    entity.state === "unknown";

  const currentMode = optimisticMode ?? entity?.state ?? "";
  const modeStyle = MODE_STYLES[currentMode];

  const handleModeSelect = (mode: string) => {
    if (isUnavailable || !entity || currentMode === mode) return;
    execute(mode, async () => {
      await entity.service.selectOption({
        serviceData: { option: mode },
      });
    });
  };

  return (
    <Card
      className={cn(
        "transition-colors duration-300",
        modeStyle?.border ?? "border-slate-800",
        isUnavailable && "opacity-50"
      )}
    >
      <CardContent className="p-3">
        <p className="text-xs font-medium text-slate-400 mb-2">{label}</p>
        <div className="flex gap-1.5">
          {modes.map((mode) => {
            const isActive = currentMode === mode;
            const style = MODE_STYLES[mode];
            const translationKey =
              `quickToggle.mode.${mode}` as TranslationKey;

            return (
              <button
                key={mode}
                type="button"
                disabled={isUnavailable}
                onClick={() => handleModeSelect(mode)}
                className={cn(
                  "flex-1 px-3 py-1.5 rounded-md text-sm font-medium",
                  "transition-colors duration-200",
                  "disabled:opacity-50 disabled:cursor-not-allowed",
                  isActive && style ? style.active : INACTIVE_STYLE
                )}
              >
                {t(translationKey)}
              </button>
            );
          })}
        </div>
        <InlineError message={error} onDismiss={clearError} />
      </CardContent>
    </Card>
  );
}
