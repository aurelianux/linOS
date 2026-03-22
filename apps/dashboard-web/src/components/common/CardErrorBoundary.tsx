import { Component, type ReactNode, type ErrorInfo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { mdiAlertCircle, mdiRefresh } from "@mdi/js";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface Props {
  children: ReactNode;
  entityId?: string;
}

interface State {
  hasError: boolean;
}

function ErrorFallback({ onRetry }: { onRetry: () => void }) {
  const { t } = useTranslation();
  return (
    <Card className="bg-slate-900 border-red-900/50">
      <CardContent className="p-4 flex items-center gap-2">
        <Icon path={mdiAlertCircle} size={0.8} className="text-red-400" />
        <p className="text-sm text-red-400 flex-1">{t("entity.failedToLoad")}</p>
        <button
          type="button"
          onClick={onRetry}
          className="p-1 rounded text-slate-400 hover:text-slate-200 hover:bg-slate-800 transition-colors"
        >
          <Icon path={mdiRefresh} size={0.7} />
        </button>
      </CardContent>
    </Card>
  );
}

export class CardErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error(`CardErrorBoundary [${this.props.entityId}]:`, error, info);
  }

  private handleRetry = () => {
    this.setState({ hasError: false });
  };

  render() {
    if (this.state.hasError) {
      return <ErrorFallback onRetry={this.handleRetry} />;
    }
    return this.props.children;
  }
}
