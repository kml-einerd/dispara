import { Component, type ErrorInfo, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 bg-zinc-900 px-4 text-white">
          <div className="flex flex-col items-center gap-2 text-center">
            <h2 className="text-xl font-semibold">Algo deu errado</h2>
            <p className="max-w-md text-sm text-zinc-400">
              Ocorreu um erro inesperado. Tente novamente ou volte ao início.
            </p>
            {import.meta.env.DEV && this.state.error && (
              <pre className="mt-4 max-w-lg overflow-auto rounded bg-zinc-800 p-3 text-left text-xs text-red-400">
                {this.state.error.message}
              </pre>
            )}
          </div>
          <div className="flex gap-3">
            <button
              onClick={this.handleRetry}
              className="rounded-md bg-white px-4 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-200 transition-colors"
            >
              Tentar novamente
            </button>
            <a
              href="/copiloto"
              className="rounded-md border border-zinc-600 px-4 py-2 text-sm font-medium text-zinc-300 hover:bg-zinc-800 transition-colors"
            >
              Voltar ao início
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
