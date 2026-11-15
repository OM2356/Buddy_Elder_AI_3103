import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

interface State {
  hasError: boolean;
  errorMessage: string;
}

export class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, errorMessage: error.message || 'An unexpected error occurred.' };
  }

  override render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#FAF7F0] dark:bg-[#0B1320] text-[#0F2544] dark:text-[#F4F7FB]">
          <div className="max-w-xl w-full rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 p-8 space-y-5">
            <div className="flex items-center gap-3 text-amber-700 dark:text-amber-400">
              <AlertTriangle className="w-8 h-8 shrink-0" aria-hidden="true" />
              <h1 className="text-2xl font-bold">Something paused unexpectedly</h1>
            </div>
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed">
              {this.state.errorMessage}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-[#0F2544] dark:bg-teal-600 text-white font-semibold hover:opacity-90 transition-opacity cursor-pointer"
            >
              <RotateCcw className="w-5 h-5" aria-hidden="true" />
              Reload Application
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}
