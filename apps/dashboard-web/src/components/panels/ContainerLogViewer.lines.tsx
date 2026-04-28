import { cn } from "@/lib/utils";
import { PINO_LEVELS, formatTimestamp, statusCodeColor, type ParsedLogLine } from "./ContainerLogViewer.helpers";

function PinoLogEntry({ parsed }: { parsed: ParsedLogLine }) {
  const pino = parsed.pino;
  if (!pino) return null;
  const levelInfo = PINO_LEVELS[pino.level] ?? { label: `L${pino.level}`, color: "text-slate-400" };
  const time = formatTimestamp(parsed.timestamp);

  if (pino.req && pino.res) {
    return (
      <div className="flex items-start gap-2 py-0.5 font-mono text-xs leading-5">
        <span className="text-slate-600 shrink-0 w-20 text-right">{time}</span>
        <span className={cn("shrink-0 w-12 text-right font-semibold", levelInfo.color)}>{levelInfo.label}</span>
        <span className="text-slate-300 shrink-0 w-10 text-right font-semibold">{pino.req.method}</span>
        <span className="text-slate-200 min-w-0 truncate flex-1" title={pino.req.url}>{pino.req.url}</span>
        <span className={cn("shrink-0 w-8 text-right font-semibold", statusCodeColor(pino.res.statusCode))}>{pino.res.statusCode}</span>
        {typeof pino.responseTime === "number" && (
          <span className="text-slate-500 shrink-0 w-14 text-right">{pino.responseTime}ms</span>
        )}
      </div>
    );
  }

  return (
    <div className="flex items-start gap-2 py-0.5 font-mono text-xs leading-5">
      <span className="text-slate-600 shrink-0 w-20 text-right">{time}</span>
      <span className={cn("shrink-0 w-12 text-right font-semibold", levelInfo.color)}>{levelInfo.label}</span>
      <span className="text-slate-200 min-w-0 flex-1 break-all">{pino.msg ?? JSON.stringify(pino)}</span>
    </div>
  );
}

function RawLogEntry({ parsed }: { parsed: ParsedLogLine }) {
  const time = formatTimestamp(parsed.timestamp);
  const content = parsed.timestamp
    ? parsed.raw.slice(parsed.raw.indexOf(parsed.timestamp) + parsed.timestamp.length).trim()
    : parsed.raw;
  return (
    <div className="flex items-start gap-2 py-0.5 font-mono text-xs leading-5">
      {time && <span className="text-slate-600 shrink-0 w-20 text-right">{time}</span>}
      <span className="text-slate-300 min-w-0 flex-1 break-all">{content || parsed.raw}</span>
    </div>
  );
}

export function LogLine({ parsed }: { parsed: ParsedLogLine }) {
  if (parsed.isPino && parsed.pino) return <PinoLogEntry parsed={parsed} />;
  return <RawLogEntry parsed={parsed} />;
}
