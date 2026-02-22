import { Component } from "react";

export default class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
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
            <button onClick={() => window.location.reload()}
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
