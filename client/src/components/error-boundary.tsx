import { Component, ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error?: any;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: any) {
    return { hasError: true, error };
  }

  componentDidCatch(error: any, errorInfo: any) {
    // eslint-disable-next-line no-console
    console.error("UI ErrorBoundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center">
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-sm text-muted-foreground mb-4">
            An unexpected error occurred while rendering this page.
          </p>
          <pre className="text-left text-xs max-w-xl overflow-auto bg-muted p-3 rounded mb-4">
            {String(this.state.error || "")}
          </pre>
          <button
            className="px-4 py-2 rounded bg-primary text-primary-foreground"
            onClick={() => window.location.reload()}
          >
            Reload
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

