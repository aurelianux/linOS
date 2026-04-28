export const PINO_LEVELS: Record<number, { label: string; color: string }> = {
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

export interface PinoLog {
  level: number;
  time: number;
  msg?: string;
  req?: { method: string; url: string };
  res?: { statusCode: number };
  responseTime?: number;
  [key: string]: unknown;
}

export interface ParsedLogLine {
  raw: string;
  isPino: boolean;
  pino?: PinoLog;
  timestamp?: string;
}

export function extractTimestamp(line: string): string | undefined {
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[.\d]*Z?)/.exec(line);
  return match?.[1];
}

export function parseLogLine(raw: string): ParsedLogLine {
  const jsonStart = raw.indexOf("{");
  if (jsonStart === -1) return { raw, isPino: false, timestamp: extractTimestamp(raw) };
  const timestampPart = jsonStart > 0 ? raw.slice(0, jsonStart).trim() : undefined;
  try {
    const parsed = JSON.parse(raw.slice(jsonStart)) as PinoLog;
    if (typeof parsed.level === "number" && typeof parsed.time === "number") {
      return { raw, isPino: true, pino: parsed, timestamp: timestampPart || new Date(parsed.time).toISOString() };
    }
  } catch { /* not valid JSON */ }
  return { raw, isPino: false, timestamp: extractTimestamp(raw) };
}

export function formatTimestamp(ts: string | undefined): string {
  if (!ts) return "";
  try {
    return new Date(ts).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit", second: "2-digit", fractionalSecondDigits: 3 });
  } catch { return ts.slice(11, 23); }
}

export function statusCodeColor(code: number): string {
  if (code >= HTTP_STATUS_OK_MIN && code <= HTTP_STATUS_OK_MAX) return "text-emerald-400";
  if (code <= HTTP_STATUS_REDIRECT_MAX) return "text-sky-400";
  if (code <= HTTP_STATUS_CLIENT_ERROR_MAX) return "text-amber-400";
  return "text-red-400";
}
