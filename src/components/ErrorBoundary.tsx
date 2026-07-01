import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle } from "lucide-react";

interface Props {
  children: ReactNode;
  /** Short label for which section this guards (shown in the fallback + logged). */
  label?: string;
  /** Compact inline fallback (for a single widget) vs. full-page fallback (for a whole route). */
  compact?: boolean;
}

interface State {
  error: Error | null;
}

/**
 * React error boundary. Without one, any component that throws during render unmounts the
 * ENTIRE tree and blanks the page — which is exactly what made the /team dashboard (a deep
 * tree of independent data widgets) go blank and take the whole backend down with it.
 *
 * Use `compact` to guard a single widget so one failure shows a small inline error instead
 * of blanking the dashboard — and surfaces which widget failed and why.
 */
export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Never blank the page silently — log for debugging.
    console.error(`[ErrorBoundary${this.props.label ? ` ${this.props.label}` : ""}]`, error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const { label, compact } = this.props;

    if (compact) {
      return (
        <div className="rounded-lg border border-destructive/40 bg-destructive/5 p-4 text-sm">
          <div className="flex items-center gap-2 font-medium text-destructive">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            {label ? `${label} failed to load` : "This section failed to load"}
          </div>
          <p className="mt-1 break-words text-muted-foreground">{error.message}</p>
          <button
            onClick={this.reset}
            className="mt-2 text-xs text-muted-foreground underline hover:text-foreground"
          >
            Retry
          </button>
        </div>
      );
    }

    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
        <div className="w-full max-w-md rounded-xl border border-destructive/40 bg-destructive/5 p-6 text-center">
          <AlertTriangle className="mx-auto w-8 h-8 text-destructive" />
          <h1 className="mt-3 font-display text-xl tracking-wide-custom">Something broke on this page</h1>
          {label && <p className="mt-1 text-sm text-muted-foreground">in {label}</p>}
          <p className="mt-2 break-words text-sm text-muted-foreground">{error.message}</p>
          <div className="mt-4 flex justify-center gap-2">
            <button
              onClick={this.reset}
              className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90"
            >
              Try again
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-muted/40"
            >
              Reload
            </button>
          </div>
        </div>
      </div>
    );
  }
}
