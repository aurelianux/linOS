/**
 * Loading state component - minimal spinner
 */
export function LoadingState() {
  return (
    <div className="flex items-center justify-center p-8">
      <div className="animate-spin">
        <div className="h-8 w-8 border-4 border-slate-700 border-t-blue-500 rounded-full" />
      </div>
    </div>
  );
}
