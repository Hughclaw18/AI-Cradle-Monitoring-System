import { Component, ReactNode } from "react";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: any, errorInfo: any) {
    // Log to console for debugging — never shown to the user
    console.error("UI ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center space-y-6">
          <div className="p-5 bg-destructive/10 rounded-full">
            <AlertTriangle className="h-12 w-12 text-destructive" />
          </div>
          <div className="space-y-2 max-w-sm">
            <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              The app ran into an unexpected problem. Your data is safe — try reloading to continue.
            </p>
          </div>
          <Button
            onClick={() => window.location.reload()}
            className="gap-2 rounded-2xl px-6"
          >
            <RefreshCw className="h-4 w-4" />
            Reload app
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}
