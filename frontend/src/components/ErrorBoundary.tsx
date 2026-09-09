import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertOctagon, RefreshCw, Home } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('Uncaught error caught by ErrorBoundary:', error, errorInfo);
  }

  private handleReload = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload();
  };

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null });
    window.location.href = '/';
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-[500px] flex items-center justify-center p-6">
          <div className="glass-panel p-8 max-w-md w-full text-center space-y-4 border-rose-200">
            <div className="w-12 h-12 rounded-full bg-rose-100 border border-rose-200 text-rose-600 flex items-center justify-center mx-auto">
              <AlertOctagon className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-900">Application Rendering Error</h2>
              <p className="text-sm text-slate-500 mt-1">
                An unexpected interface issue occurred. Our telemetry has logged this anomaly.
              </p>
            </div>
            {this.state.error && (
              <pre className="text-xs bg-slate-100 p-3 rounded-lg text-slate-700 overflow-x-auto text-left font-mono border border-slate-200">
                {this.state.error.message}
              </pre>
            )}
            <div className="flex items-center justify-center gap-2.5 pt-1">
              <button
                type="button"
                onClick={this.handleGoHome}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold btn-interactive border border-slate-200"
              >
                <Home className="w-3.5 h-3.5" />
                Return to Live View
              </button>
              <button
                type="button"
                onClick={this.handleReload}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-primary hover:bg-blue-700 text-white text-xs font-semibold btn-interactive shadow-sm"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                Reload Platform
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
