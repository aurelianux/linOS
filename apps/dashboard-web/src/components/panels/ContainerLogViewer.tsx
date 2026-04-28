import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { mdiClose, mdiDelete, mdiArrowDown, mdiContentCopy, mdiCheck } from "@mdi/js";
import { Icon } from "@/components/ui/icon";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useContainerLogsSocket } from "@/hooks/useContainerLogsSocket";
import { parseLogLine } from "./ContainerLogViewer.helpers";
import { LogLine } from "./ContainerLogViewer.lines";

interface ContainerLogViewerProps {
  containerId: string;
  containerName: string;
  onClose: () => void;
}

export function ContainerLogViewer({ containerId, containerName, onClose }: ContainerLogViewerProps) {
  const { lines, connected, subscribedTo, error, subscribe, unsubscribe, clearLines } = useContainerLogsSocket();
  const scrollRef = useRef<HTMLDivElement>(null);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");

  useEffect(() => { subscribe(containerId); return () => unsubscribe(); }, [containerId, subscribe, unsubscribe]);
  const parsedLines = useMemo(() => lines.map(parseLogLine), [lines]);
  useEffect(() => { if (autoScroll && scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight; }, [parsedLines, autoScroll]);

  const handleScroll = useCallback(() => {
    const el = scrollRef.current;
    if (!el) return;
    setAutoScroll(el.scrollHeight - el.scrollTop - el.clientHeight < 40);
  }, []);

  const scrollToBottom = useCallback(() => {
    if (scrollRef.current) { scrollRef.current.scrollTop = scrollRef.current.scrollHeight; setAutoScroll(true); }
  }, []);

  const handleCopy = useCallback(async () => {
    try { await navigator.clipboard.writeText(lines.join("\n")); setCopyState("copied"); setTimeout(() => setCopyState("idle"), 2000); }
    catch { /* clipboard unavailable */ }
  }, [lines]);

  return (
    <div className="rounded-lg border border-slate-800 bg-slate-950 flex flex-col overflow-hidden">
      <div className="flex items-center gap-2 px-3 py-2 bg-slate-900 border-b border-slate-800">
        <span className="text-sm font-semibold text-slate-100 truncate flex-1">{containerName}</span>
        <Badge variant={connected && subscribedTo ? "success" : "secondary"} className="text-[10px] px-1.5 py-0">
          {connected && subscribedTo ? "Live" : connected ? "Connected" : "Disconnected"}
        </Badge>
        <span className="text-xs text-slate-500 tabular-nums">{parsedLines.length} lines</span>
        <Button variant="secondary" size="sm" onClick={handleCopy} aria-label="Copy logs" title="Copy logs" className="h-6 w-6 p-0">
          <Icon path={copyState === "copied" ? mdiCheck : mdiContentCopy} size={0.55} />
        </Button>
        <Button variant="secondary" size="sm" onClick={clearLines} aria-label="Clear logs" title="Clear logs" className="h-6 w-6 p-0">
          <Icon path={mdiDelete} size={0.55} />
        </Button>
        <Button variant="secondary" size="sm" onClick={onClose} aria-label="Close log viewer" title="Close" className="h-6 w-6 p-0">
          <Icon path={mdiClose} size={0.6} />
        </Button>
      </div>

      {error && <div className="px-3 py-1.5 bg-red-900/30 border-b border-red-800/50"><p className="text-xs text-red-400">{error}</p></div>}

      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto overflow-x-hidden px-3 py-2 min-h-[200px] max-h-[400px]">
        {parsedLines.length === 0 ? (
          <p className="text-xs text-slate-500 text-center py-4">Waiting for logs…</p>
        ) : (
          parsedLines.map((parsed, i) => <LogLine key={i} parsed={parsed} />)
        )}
      </div>

      {!autoScroll && (
        <div className="flex justify-center py-1 border-t border-slate-800">
          <button type="button" onClick={scrollToBottom} className={cn("flex items-center gap-1 text-xs text-slate-400 hover:text-slate-200 transition-colors")}>
            <Icon path={mdiArrowDown} size={0.5} />Scroll to bottom
          </button>
        </div>
      )}
    </div>
  );
}
