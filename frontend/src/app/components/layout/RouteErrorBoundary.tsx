import { Component, type ReactNode } from "react";
import { useRouteError, isRouteErrorResponse, useNavigate } from "react-router";
import { AlertTriangle } from "lucide-react";

interface FallbackProps {
  error: unknown;
  onReset?: () => void;
}

function ErrorFallback({ error, onReset }: FallbackProps) {
  const message =
    error instanceof Error
      ? error.message
      : typeof error === "string"
        ? error
        : "An unexpected error occurred.";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertTriangle className="h-8 w-8 text-destructive" />
      </div>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Something went wrong</h1>
        <p className="text-sm text-muted-foreground">The page encountered an error and could not render.</p>
      </div>
      <details className="w-full max-w-lg rounded-md border bg-muted/50 text-left">
        <summary className="cursor-pointer px-4 py-2 text-sm font-medium">Error details</summary>
        <pre className="overflow-auto whitespace-pre-wrap break-words px-4 py-3 text-xs text-muted-foreground">
          {message}
        </pre>
      </details>
      <div className="flex gap-3">
        <button
          type="button"
          onClick={() => window.location.reload()}
          className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          aria-label="Reload page"
        >
          Reload page
        </button>
        {onReset && (
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center rounded-md border px-4 py-2 text-sm font-medium hover:bg-accent"
            aria-label="Go back to home"
          >
            Go to home
          </button>
        )}
      </div>
    </div>
  );
}

export function RouteErrorBoundary() {
  const error = useRouteError();
  const navigate = useNavigate();

  if (isRouteErrorResponse(error)) {
    return (
      <ErrorFallback
        error={`${error.status} ${error.statusText || ""}`.trim()}
        onReset={() => navigate("/")}
      />
    );
  }

  return <ErrorFallback error={error} onReset={() => navigate("/")} />;
}

interface Props {
  children: ReactNode;
}

interface State {
  error: unknown;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <ErrorFallback
          error={this.state.error}
          onReset={() => this.setState({ error: null })}
        />
      );
    }
    return this.props.children;
  }
}
