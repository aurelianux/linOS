import { Component, type ReactNode, type ErrorInfo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { mdiAlertCircle } from "@mdi/js";
import { useTranslation } from "@/lib/i18n/useTranslation";

interface Props {
  children: ReactNode;
  entityId?: string;
}

interface State {
  hasError: boolean;
}

function ErrorFallback() {
  const { t } = useTranslation();
  return (
    <Card className="bg-slate-900 border-red-900/50">
      <CardContent className="p-4 flex items-center gap-2">
        <Icon path={mdiAlertCircle} size={0.8} className="text-red-400" />
        <p className="text-sm text-red-400">{t("entity.failedToLoad")}</p>
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

  render() {
    if (this.state.hasError) {
      return <ErrorFallback />;
    }
    return this.props.children;
  }
}
