import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import {
  mdiClose,
  mdiDelete,
  mdiArrowDown,
  mdiContentCopy,
  mdiCheck,
} from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useContainerLogsSocket } from "@/hooks/useContainerLogsSocket";

// ─── Constants ────────────────────────────────────────────────────────────

/** Pino log level numbers → label + color */
const PINO_LEVELS: Record<number, { label: string; color: string }> = {
  10: { label: "TRACE", color: "text-slate-500" },
  20: { label: "DEBUG", color: "text-slate-400" },
  30: { label: "INFO", color: "text-sky-400" },
  40: { label: "WARN", color: "text-amber-400" },
  50: { label: "ERROR", color: "text-red-400" },
  60: { label: "FATAL", color: "text-red-500" },
};

const HTTP_STATUS_OK_MIN = 200;
const HTTP_STATUS_OK_MAX = 299;
const HTTP_STATUS_REDIRECT_MAX = 399;
const HTTP_STATUS_CLIENT_ERROR_MAX = 499;

// ─── Types ────────────────────────────────────────────────────────────────

interface PinoLog {
  level: number;
  time: number;
  msg?: string;
  req?: { method: string; url: string };
  res?: { statusCode: number };
  responseTime?: number;
  [key: string]: unknown;
}

interface ParsedLogLine {
  /** Original raw line */
  raw: string;
  /** Whether we successfully parsed this as pino JSON */
  isPino: boolean;
  /** Parsed pino data (only if isPino) */
  pino?: PinoLog;
  /** Extracted timestamp string */
  timestamp?: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────

/**
 * Try to parse a raw log line as pino JSON.
 * Docker logs often have a timestamp prefix before the JSON.
 * Format: "2026-04-07T18:54:24.760Z {\"level\":30,...}"
 */
function parseLogLine(raw: string): ParsedLogLine {
  // Try to find JSON object in the line
  const jsonStart = raw.indexOf("{");
  if (jsonStart === -1) {
    return { raw, isPino: false, timestamp: extractTimestamp(raw) };
  }

  const timestampPart = jsonStart > 0 ? raw.slice(0, jsonStart).trim() : undefined;

  try {
    const parsed = JSON.parse(raw.slice(jsonStart)) as PinoLog;
    // Validate it looks like a pino log
    if (typeof parsed.level === "number" && typeof parsed.time === "number") {
      return {
        raw,
        isPino: true,
        pino: parsed,
        timestamp: timestampPart || new Date(parsed.time).toISOString(),
      };
    }
  } catch {
    // Not valid JSON — fall through
  }

  return { raw, isPino: false, timestamp: extractTimestamp(raw) };
}

function extractTimestamp(line: string): string | undefined {
  // Match ISO-8601 timestamp at the start of the line
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.\d]*Z?)/.exec(line);
  return match?.[1];
}

function formatTimestamp(ts: string | undefined): string {
  if (!ts) return "";
  try {
    const d = new Date(ts);
    return d.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      fractionalSecondDigits: 3,
    });
  } catch {
    return ts.slice(11, 23);
  }
}

function statusCodeColor(code: number): string {
  if (code >= HTTP_STATUS_OK_MIN && code <= HTTP_STATUS_OK_MAX) return "text-emerald-400";
  if (code <= HTTP_STATUS_REDIRECT_MAX) return "text-sky-400";
  if (code <= HTTP_STATUS_CLIENT_ERROR_MAX) return "text-amber-400";
  return "text-red-400";
}

// ─── Log Line Component ──────────────────────────────────────────────────

function PinoLogEntry({ parsed }: { parsed: ParsedLogLine }) {
  const pino = parsed.pino;
  if (!pino) return null;

  const levelInfo = PINO_LEVELS[pino.level] ?? { label: `L${pino.level}`, color: "text-slate-400" };
  const time = formatTimestamp(parsed.timestamp);

  // HTTP request log (has req and res)
  if (pino.req && pino.res) {
    return (
      <div className="flex items-start gap-2 py-0.5 font-mono text-xs leading-5">
        <span className="text-slate-600 shrink-0 w-20 text-right">{time}</span>
        <span className={cn("shrink-0 w-12 text-right font-semibold", levelInfo.color)}>
          {levelInfo.label}
        </span>
        <span className="text-slate-300 shrink-0 w-10 text-right font-semibold">
          {pino.req.method}
        </span>
        <span className="text-slate-200 min-w-0 truncate flex-1" title={pino.req.url}>
          {pino.req.url}
        </span>
        <span className={cn("shrink-0 w-8 text-right font-semibold", statusCodeColor(pino.res.statusCode))}>
          {pino.res.statusCode}
        </span>
        {typeof pino.responseTime === "number" && (
          <span className="text-slate-500 shrink-0 w-14 text-right">
            {pino.responseTime}ms
          </span>
        )}
      </div>
    );
  }

  // Generic pino log
  return (
    <div className="flex items-start gap-2 py-0.5 font-mono text-xs leading-5">
      <span className="text-slate-600 shrink-0 w-20 text-right">{time}</span>
      <span className={cn("shrink-0 w-12 text-right font-semibold", levelInfo.color)}>
        {levelInfo.label}
      </span>
      <span className="text-slate-200 min-w-0 flex-1 break-all">
        {pino.msg ?? JSON.stringify(pino)}
      </span>
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
      {time && (
        <span className="text-slate-600 shrink-0 w-20 text-right">{time}</span>
      )}
      <span className="text-slate-300 min-w-0 flex-1 break-all">{content || parsed.raw}</span>
    </div>
  );
}

function LogLine({ parsed }: { parsed: ParsedLogLine }) {
  if (parsed.isPino && parsed.pino) {
    return <PinoLogEntry parsed={parsed} />;
  }
  return <RawLogEntry parsed={parsed} />;
}

// ─── Main Component ──────────────────────────────────────────────────────

interface ContainerLogViewerProps {
  containerId: string;
  containerName: string;
  onClose: () => void;
}

export function ContainerLogViewer({
  containerId,
  containerName,
  onClose,
}: ContainerLogViewerProps) {
  const { lines, connected, subscribedTo, error, subscribe, unsubscribe, clearLines } =
    useContainerLogsSocket();

  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  // Subscribe when the container changes
  useEffect(() => {
    subscribe(containerId);
    return () => unsubscribe();
  }, [containerId, subscribe, unsubscribe]);

  // Parse all lines
  const parsedLines = useMemo(() => lines.map(parseLogLine), [lines]);

  // Auto-scroll to bottom when new lines arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [parsedLines, autoScroll]);

  // Detect user scroll to toggle auto-scroll
  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 40;
    setAutoScroll(atBottom);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
      setAutoScroll(true);
    }
  }, []);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(lines.join("\n"));
      setCopyState("copied");
      setTimeout(() => setCopyState("idle"), 2000);
    } catch {
      // Clipboard API may not be available
    }
  }, [lines]);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 flex flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800">
        <span className="text-sm font-semibold text-slate-100 truncate flex-1">
          {containerName}
        </span>

        <Badge
          variant={connected && subscribedTo ? "success" : "secondary"}
          className="text-[10px] px-1.5 py-0"
        >
          {connected && subscribedTo ? "Live" : connected ? "Connected" : "Disconnected"}
        </Badge>

        <span className="text-xs text-slate-500 tabular-nums">
          {parsedLines.length} lines
        </span>

        <Button
          variant="secondary"
          size="sm"
          onClick={handleCopy}
          aria-label="Copy logs"
          title="Copy logs"
          className="h-6 w-6 p-0"
        >
          <Icon path={copyState === "copied" ? mdiCheck : mdiContentCopy} size={0.55} />
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={clearLines}
          aria-label="Clear logs"
          title="Clear logs"
          className="h-6 w-6 p-0"
        >
          <Icon path={mdiDelete} size={0.55} />
        </Button>

        <Button
          variant="secondary"
          size="sm"
          onClick={onClose}
          aria-label="Close log viewer"
          title="Close"
          className="h-6 w-6 p-0"
        >
          <Icon path={mdiClose} size={0.6} />
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-3 py-1.5 bg-red-900/30 border-b border-red-800/50">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Log content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 min-h-[200px] max-h-[400px]"
      >
        {parsedLines.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">
            Waiting for logs…
          </p>
        ) : (
          parsedLines.map((parsed, i) => (
            <LogLine key={i} parsed={parsed} />
          ))
        )}
      </div>

      {/* Scroll-to-bottom button */}
      {!autoScroll && (
        <div className="flex justify-center py-1 border-t border-slate-800">
          <button
            type="button"
            onClick={scrollToBottom}
            className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors"
          >
            <Icon path={mdiArrowDown} size={0.5} />
            Scroll to bottom
          </button>
        </div>
      )}
    </div>
  );
}
