import { Icon } from "@/components/ui/icon";
import { BottomSheet } from "@/components/ui/bottom-sheet";
import { cn } from "@/lib/utils";

interface SwitchCardSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  isOn: boolean;
  iconPath: string;
  onToggle: () => void;
  onLabel: string;
  offLabel: string;
}

export function SwitchCardSheet({
  open, onClose, title, isOn, iconPath, onToggle, onLabel, offLabel,
}: SwitchCardSheetProps) {
  return (
    <BottomSheet open={open} onClose={onClose} title={title}>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Icon path={iconPath} size={1.2} className={isOn ? "text-amber-400" : "text-slate-500"} />
            <span className="text-sm text-slate-300">{isOn ? onLabel : offLabel}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onToggle}
          className={cn(
            "w-full py-3 rounded-lg text-sm font-semibold transition-colors",
            isOn
              ? "bg-slate-700 text-slate-100 hover:bg-slate-600"
              : "bg-amber-400 text-slate-950 hover:bg-amber-300"
          )}
        >
          {isOn ? offLabel : onLabel}
        </button>
      </div>
    </BottomSheet>
  );
}
