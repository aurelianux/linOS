import { cn } from "@/lib/utils";

interface SystemMetricBadgeProps {
  label: string;
  percent: number;
  history: number[];
}

const SPARKLINE_WIDTH = 48;
const SPARKLINE_HEIGHT = 16;

function getMetricColor(percent: number): string {
  if (percent >= 85) return "text-red-400";
  if (percent >= 60) return "text-amber-400";
  return "text-emerald-400";
}

function getStrokeColor(percent: number): string {
  if (percent >= 85) return "#f87171"; // red-400
  if (percent >= 60) return "#fbbf24"; // amber-400
  return "#34d399"; // emerald-400
}

function buildSparklinePath(history: number[]): string {
  if (history.length < 2) return "";

  const maxVal = 100;
  const step = SPARKLINE_WIDTH / (history.length - 1);

  return history
    .map((v, i) => {
      const x = i * step;
      const y = SPARKLINE_HEIGHT - (v / maxVal) * SPARKLINE_HEIGHT;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
}

export function SystemMetricBadge({
  label,
  percent,
  history,
}: SystemMetricBadgeProps) {
  const colorClass = getMetricColor(percent);
  const strokeColor = getStrokeColor(percent);
  const path = buildSparklinePath(history);

  return (
    <div className="flex items-center gap-1.5">
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {history.length >= 2 && (
        <svg
          width={SPARKLINE_WIDTH}
          height={SPARKLINE_HEIGHT}
          viewBox={`0 0 ${SPARKLINE_WIDTH} ${SPARKLINE_HEIGHT}`}
          className="shrink-0"
        >
          <path
            d={path}
            fill="none"
            stroke={strokeColor}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )}
      <span className={cn("text-xs font-semibold tabular-nums", colorClass)}>
        {percent}%
      </span>
    </div>
  );
}
