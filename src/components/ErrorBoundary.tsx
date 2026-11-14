import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface ErrorBoundaryProps {
  fallbackTitle?: string;
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      errorMessage: error?.message || 'Unexpected rendering error occurred.',
    };
  }

  componentDidCatch(error: Error) {
    console.error('Prob8 ErrorBoundary caught:', error);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="mx-auto max-w-xl my-12 rounded-2xl border border-rose-200 dark:border-rose-900 bg-white dark:bg-[#111827] p-6 text-center space-y-4">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-5 w-5" />
          </div>
          <div>
            <h2 className="font-display text-lg font-bold text-slate-900 dark:text-white">
              {this.props.fallbackTitle || 'Something went wrong loading this view'}
            </h2>
            <p className="mt-1 text-xs text-slate-600 dark:text-slate-300 font-mono">
              {this.state.errorMessage}
            </p>
          </div>
          <button
            type="button"
            onClick={() => this.setState({ hasError: false, errorMessage: '' })}
            className="inline-flex h-10 items-center gap-2 rounded-xl bg-[#0F766E] px-4 text-xs font-semibold text-white hover:bg-[#0D625B]"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Reload View
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
