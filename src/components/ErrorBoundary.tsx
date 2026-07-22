import { Component, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, info);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback;
      return (
        <div className="empty-state" style={{ padding: "var(--space-2xl) var(--space-md)" }}>
          <span className="empty-state__icon"><AlertTriangle size={40} /></span>
          <h2 style={{ fontSize: "1.1rem", marginBottom: "var(--space-sm)" }}>
            Something went wrong
          </h2>
          <p className="text-sm text-muted" style={{ marginBottom: "var(--space-md)" }}>
            An unexpected error occurred while loading this page.
          </p>
          <button className="btn btn--primary" onClick={this.handleRetry}>
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
