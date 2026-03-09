import { useEntity } from "@hakit/core";
import { cn } from "@/lib/utils";
import { useTranslation } from "@/lib/i18n/useTranslation";
import type { DashboardScene } from "@/lib/api/types";

interface SceneButtonProps {
  scene: DashboardScene;
}

/**
 * Pill button that activates a HA scene on click.
 * Dims when the scene entity is unavailable.
 */
export function SceneButton({ scene }: SceneButtonProps) {
  const entity = useEntity(scene.entityId, { returnNullIfNotFound: true });
  const { t } = useTranslation();
  const isUnavailable = !entity || entity.state === "unavailable" || entity.state === "unknown";

  const handleActivate = () => {
    if (isUnavailable || !entity) return;
    entity.service.turnOn().catch((err: unknown) => {
      console.error("Failed to activate scene:", scene.entityId, err);
    });
  };

  return (
    <button
      onClick={handleActivate}
      disabled={isUnavailable}
      title={isUnavailable ? t("entity.unavailable") : scene.label}
      className={cn(
        "px-3 py-1 rounded-full text-xs font-medium transition-colors duration-200",
        "border border-slate-700 bg-slate-800 text-slate-300",
        "hover:bg-slate-700 hover:text-slate-100 hover:border-slate-600",
        "disabled:opacity-40 disabled:cursor-not-allowed"
      )}
    >
      {scene.label}
    </button>
  );
}
