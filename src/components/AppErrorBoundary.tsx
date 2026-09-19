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
        <div className="flex min-h-dvh flex-col items-center justify-center gap-3 bg-[#f4f6fb] p-6 text-center">
          <p className="text-lg font-bold text-slate-900">Something went wrong</p>
          <p className="max-w-sm text-sm text-rose-600">{this.state.error.message}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white"
          >
            Reload app
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
