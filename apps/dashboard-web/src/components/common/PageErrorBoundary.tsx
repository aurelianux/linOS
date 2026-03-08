import { Component, type ReactNode, type ErrorInfo } from "react";
import { mdiAlertCircleOutline, mdiRefresh } from "@mdi/js";
import Icon from "@mdi/react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

/**
 * Page-level error boundary.
 * Catches unhandled errors in the entire page subtree and shows a full-screen
 * fallback so a single page crash doesn't take down the whole app.
 */
export class PageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("PageErrorBoundary caught:", error, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-4 p-8">
          <Icon path={mdiAlertCircleOutline} size={2} className="text-red-400" />
          <div className="text-center space-y-1">
            <p className="text-slate-100 font-semibold">Something went wrong</p>
            <p className="text-sm text-slate-400">
              {this.state.error?.message ?? "An unexpected error occurred."}
            </p>
          </div>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            className="flex items-center gap-2 px-4 py-2 rounded-md bg-slate-800 text-slate-200 hover:bg-slate-700 transition-colors text-sm"
          >
            <Icon path={mdiRefresh} size={0.8} />
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
