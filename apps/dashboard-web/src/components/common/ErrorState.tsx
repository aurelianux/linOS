import { Button } from "../ui/button";

export interface ErrorStateProps {
  message: string;
  onRetry?: () => void;
}

/**
 * Error state component with retry action
 */
export function ErrorState({ message, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center p-8 space-y-4">
      <div className="text-red-400">
        <svg
          className="w-12 h-12"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4v.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
      </div>
      <p className="text-center text-slate-300">{message}</p>
      {onRetry && (
        <Button onClick={onRetry} size="md">
          Retry
        </Button>
      )}
    </div>
  );
}
