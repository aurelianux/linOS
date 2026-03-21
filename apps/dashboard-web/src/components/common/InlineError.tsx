import { useEffect } from "react";

interface InlineErrorProps {
  message: string | null;
  onDismiss: () => void;
  autoHideMs?: number;
}

export function InlineError({
  message,
  onDismiss,
  autoHideMs = 3000,
}: InlineErrorProps) {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(onDismiss, autoHideMs);
    return () => clearTimeout(timer);
  }, [message, onDismiss, autoHideMs]);

  if (!message) return null;

  return (
    <p className="text-xs text-red-400 mt-1 animate-pulse">{message}</p>
  );
}
