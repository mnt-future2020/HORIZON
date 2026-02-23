import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("[ErrorBoundary] Caught error:", error);
    console.error("[ErrorBoundary] Component stack:", errorInfo?.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-background flex items-center justify-center px-4">
          <div className="text-center max-w-md">
            <h1 className="font-display text-3xl font-black tracking-athletic">Something went wrong</h1>
            <p className="text-muted-foreground font-semibold mt-3 mb-8">
              An unexpected error occurred. Please try reloading the page.
            </p>
            {this.state.error && (
              <div className="mb-6 p-4 rounded-lg bg-destructive/10 border border-destructive/30 text-left">
                <p className="text-xs font-mono text-destructive break-all">
                  {this.state.error.message || String(this.state.error)}
                </p>
              </div>
            )}
            <button onClick={() => { this.setState({ hasError: false, error: null }); window.location.reload(); }}
              className="inline-flex items-center justify-center h-11 px-8 rounded-xl bg-primary text-primary-foreground font-bold">
              Reload Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
