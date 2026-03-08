import { Component, type ReactNode, type ErrorInfo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import Icon from "@mdi/react";
import { mdiAlertCircle } from "@mdi/js";

interface Props {
  children: ReactNode;
  entityId?: string;
}

interface State {
  hasError: boolean;
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
      return (
        <Card className="bg-slate-900 border-red-900/50">
          <CardContent className="p-4 flex items-center gap-2">
            <Icon path={mdiAlertCircle} size={0.8} className="text-red-400" />
            <p className="text-sm text-red-400">Failed to load</p>
          </CardContent>
        </Card>
      );
    }
    return this.props.children;
  }
}
