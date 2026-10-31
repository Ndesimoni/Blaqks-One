import React from 'react';
import { ErrorBoundaryFallback } from './ErrorBoundaryFallback.jsx';

export class ErrorBoundary extends React.Component {
  state = { error: null };
  static getDerivedStateFromError(error) {
    return { error };
  }
  componentDidCatch(error, info) {
    console.error('CRM screen failed', error, info);
  }
  render() {
    return this.state.error ? (
      <ErrorBoundaryFallback onRetry={() => this.setState({ error: null })} />
    ) : (
      this.props.children
    );
  }
}
