import { Component, type ReactNode, type ErrorInfo } from 'react';
import { useTranslation } from 'react-i18next';
import { getErrorMessage } from '@/util/error';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: string | null;
}

function ErrorFallback({ error }: { error: string }): JSX.Element {
  const { t } = useTranslation();
  return (
    <div style={{ padding: '2rem', color: '#ff6b6b', fontFamily: 'monospace' }}>
      <h2>{t('common.somethingWentWrong')}</h2>
      <pre>{error}</pre>
    </div>
  );
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, error: null };

  static getDerivedStateFromError(error: unknown): State {
    return { hasError: true, error: getErrorMessage(error) };
  }

  componentDidCatch(error: unknown, info: ErrorInfo) {
    console.error('[ErrorBoundary]', error, info);
  }

  render() {
    if (this.state.hasError && this.state.error) {
      return this.props.fallback ?? <ErrorFallback error={this.state.error} />;
    }
    return <>{this.props.children}</>;
  }
}
