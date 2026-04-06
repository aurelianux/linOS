import { Icon } from "@/components/ui/icon";
import { ToggleChip } from "@/components/ui/toggle-chip";
import { useScrollSuppression } from "@/hooks/useScrollSuppression";
import type { DashboardConfig, QuickToggleConfig } from "@/lib/api/types";
import type { TranslationKey } from "@/lib/i18n/translations";
import { useTranslation } from "@/lib/i18n/useTranslation";
import { cn } from "@/lib/utils";
import { useHass } from "@hakit/core";
import { mdiCheck } from "@mdi/js";
import { useCallback, useMemo, useState } from "react";

const MODE_OPTIONS: Array<{
  value: string;
  labelKey: TranslationKey;
  activeClass: string;
}> = [
  { value: "hell", labelKey: "quickToggle.mode.hell", activeClass: "bg-amber-400 text-slate-950" },
  { value: "chill", labelKey: "quickToggle.mode.chill", activeClass: "bg-sky-400 text-slate-950" },
  { value: "aus", labelKey: "quickToggle.mode.aus", activeClass: "bg-slate-600 text-slate-100" },
];

type ExecutionState = "idle" | "executing" | "success" | "error";

interface QuickAccessPanelProps {
  config: DashboardConfig;
}

export function QuickAccessPanel({ config }: QuickAccessPanelProps) {
  const { t } = useTranslation();
  const helpers = useHass((s) => s.helpers);
  const entities = useHass((s) => s.entities);
  const suppressTaps = useScrollSuppression();

  const [userSelectedRoomIds, setUserSelectedRoomIds] = useState<Set<string> | null>(null);
  const [selectedMode, setSelectedMode] = useState<string | null>(null);
  const [executionState, setExecutionState] = useState<ExecutionState>("idle");

  const quickToggles = config.quickToggles as QuickToggleConfig | undefined;
  const rooms = config.rooms;

  const roomToggleMap = useMemo(
    () =>
      quickToggles
        ? new Map(quickToggles.rooms.map((r) => [r.roomId, r.entity]))
        : new Map<string, `input_select.${string}`>(),
    [quickToggles]
  );

  const availableRooms = useMemo(
    () => rooms.filter((r) => roomToggleMap.has(r.id)),
    [rooms, roomToggleMap]
  );

  // Derive effective selection: default to wohnzimmer until user interacts
  const defaultRoomIds = useMemo(() => {
    const hasWohnzimmer = availableRooms.some((r) => r.id === "wohnzimmer");
    return hasWohnzimmer ? new Set(["wohnzimmer"]) : new Set<string>();
  }, [availableRooms]);

  const selectedRoomIds = userSelectedRoomIds ?? defaultRoomIds;
  const setSelectedRoomIds = setUserSelectedRoomIds;

  // Read current mode from the first selected room's entity to preselect
  const firstSelectedRoomId = Array.from(selectedRoomIds)[0];
  const firstEntityId = firstSelectedRoomId ? roomToggleMap.get(firstSelectedRoomId) : undefined;
  const firstEntityState = firstEntityId ? (entities[firstEntityId]?.state as string | undefined) : undefined;

  // Auto-preselect mode from entity state when user hasn't chosen yet
  const effectiveMode = selectedMode ?? firstEntityState ?? null;

  if (!quickToggles) return null;

  const modes = quickToggles.modes;
  const allSelected = availableRooms.length > 0 && availableRooms.every((r) => selectedRoomIds.has(r.id));

  const handleSelectAll = () => {
    if (allSelected) {
      setSelectedRoomIds(new Set());
    } else {
      setSelectedRoomIds(new Set(availableRooms.map((r) => r.id)));
    }
    setSelectedMode(null);
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
    setSelectedMode(null);
  };

  const handleModeSelect = (mode: string) => {
    setSelectedMode(mode);
  };

  const buildSummary = (): string => {
    if (selectedRoomIds.size === 0 || !effectiveMode) {
      return t("quickToggle.noSelection");
    }
    const roomNames = availableRooms
      .filter((r) => selectedRoomIds.has(r.id))
      .map((r) => r.name);
    const modeOption = MODE_OPTIONS.find((m) => m.value === effectiveMode);
    const modeLabel = modeOption ? t(modeOption.labelKey) : effectiveMode;
    return `${roomNames.join(" & ")} → ${modeLabel}`;
  };

  const canExecute = selectedRoomIds.size > 0 && effectiveMode !== null && executionState !== "executing";

  const handleExecute = useCallback(async () => {
    if (!effectiveMode || selectedRoomIds.size === 0 || executionState === "executing") return;

    setExecutionState("executing");

    const entityIds = Array.from(selectedRoomIds)
      .map((roomId) => roomToggleMap.get(roomId))
      .filter((e): e is `input_select.${string}` => !!e);

    try {
      await Promise.all(
        entityIds.map((entityId) =>
          helpers.callService({
            domain: "input_select",
            service: "select_option",
            serviceData: { option: effectiveMode },
            target: { entity_id: entityId },
          })
        )
      );
      
      setExecutionState("success");
      setTimeout(() => setExecutionState("idle"), 1500);
    } catch (err: unknown) {
      console.error("Failed to set quick access mode:", err);
      setExecutionState("error");
      setTimeout(() => setExecutionState("idle"), 2000);
    }
  }, [effectiveMode, selectedRoomIds, executionState, roomToggleMap, helpers]);

  // Build mode segment options from config
  const modeSegmentOptions = modes.map((mode) => {
    const opt = MODE_OPTIONS.find((m) => m.value === mode);
    return {
      value: mode,
      labelKey: (opt?.labelKey ?? mode) as TranslationKey,
      activeClass: opt?.activeClass,
    };
  });

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

      {/* Mode selection buttons */}
      <div>
        <p className="text-xs text-slate-500 mb-1.5">{t("quickToggle.selectMode")}</p>
        <div className="flex gap-2">
          {modeSegmentOptions.map((opt) => {
            const isActive = effectiveMode === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => {
                  if (!suppressTaps) handleModeSelect(opt.value);
                }}
                className={cn(
                  "flex-1 py-3 rounded-lg text-sm font-semibold transition-all duration-200",
                  "border select-none",
                  isActive && opt.activeClass
                    ? cn(opt.activeClass, "border-transparent shadow-sm")
                    : "bg-slate-800 text-slate-400 border-slate-700 hover:border-slate-500 hover:text-slate-200"
                )}
              >
                {t(opt.labelKey)}
              </button>
            );
          })}
        </div>
      </div>

      {/* Execute button */}
      <button
        type="button"
        disabled={!canExecute}
        onClick={handleExecute}
        className={cn(
          "w-full py-3 rounded-lg text-sm font-semibold transition-all duration-200",
          "border select-none flex items-center justify-center gap-2",
          executionState === "success"
            ? "bg-emerald-500 text-slate-950 border-emerald-500"
            : executionState === "error"
              ? "bg-red-500 text-slate-950 border-red-500"
              : canExecute
                ? "bg-amber-400 text-slate-950 border-amber-400 hover:bg-amber-300 active:bg-amber-500"
                : "bg-slate-800 text-slate-500 border-slate-700 cursor-not-allowed"
        )}
      >
        {executionState === "success" && (
          <Icon path={mdiCheck} size={0.7} className="animate-scale-in" />
        )}
        {executionState === "executing" ? "…" : executionState === "success" ? t("quickToggle.execute") : buildSummary()}
      </button>
    </div>
  );
}
