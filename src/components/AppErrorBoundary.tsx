import { Component, type ErrorInfo, type ReactNode } from 'react';

type Props = { children: ReactNode };
type State = { error: Error | null };

export class AppErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[AppErrorBoundary]', error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-white p-6 text-center">
          <p className="font-display text-lg font-semibold text-ink">Something went wrong</p>
          <p className="max-w-sm text-sm text-overdue">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-[10px] bg-action px-5 py-2.5 text-sm font-semibold text-white"
          >
            Reload app
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
