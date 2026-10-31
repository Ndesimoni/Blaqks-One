import React from 'react';
import { Button } from './Button.jsx';

function ErrorBoundaryFallback({ onRetry }) {
  return (
    <div className="empty" role="alert">
      <h3>This screen could not be displayed</h3>
      <p>Your saved records have not been removed. Retry this screen or reload the page.</p>
      <div className="recovery-actions">
        {onRetry && <Button onClick={onRetry}>Try again</Button>}
        <Button variant="light" onClick={() => window.location.reload()}>
          Reload page
        </Button>
      </div>
    </div>
  );
}

export { ErrorBoundaryFallback };
