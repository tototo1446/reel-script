
import React from 'react';

interface Props {
  children: React.ReactNode;
  fallbackLabel?: string;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends React.Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    console.error(`[ErrorBoundary${this.props.fallbackLabel ? ` - ${this.props.fallbackLabel}` : ''}]`, error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ padding: '24px', background: 'rgba(127,29,29,0.3)', borderRadius: '12px', border: '1px solid rgba(239,68,68,0.5)', margin: '16px 0' }}>
          <h3 style={{ color: '#fca5a5', fontWeight: 'bold', marginBottom: '8px' }}>
            {this.props.fallbackLabel || 'Section'} Error
          </h3>
          <pre style={{ color: '#fecaca', fontSize: '12px', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
            {this.state.error?.message}
          </pre>
          <pre style={{ color: '#a1a1aa', fontSize: '10px', whiteSpace: 'pre-wrap', wordBreak: 'break-all', marginTop: '8px' }}>
            {this.state.error?.stack}
          </pre>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{ marginTop: '12px', padding: '6px 16px', background: '#dc2626', color: 'white', borderRadius: '8px', border: 'none', cursor: 'pointer', fontSize: '12px' }}
          >
            Retry
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
