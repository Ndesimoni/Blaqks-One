import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { Icon } from '../../components/ui/Icon.jsx';
import '../../components/ui/state-view.css';

/** The CRM couldn't open, or is still opening: the mockup's state style, full screen. */
export function ServerStatus({ title, message, retry, signIn }) {
  return (
    <main className={'session-status state-view' + (retry ? ' state-view-error' : '')}>
      <span className="state-view-icon" aria-hidden="true">
        <Icon name={retry ? 'close' : 'clock'} size={28} />
      </span>
      <h1>{title}</h1>
      <p role={retry ? 'alert' : 'status'}>{message}</p>
      <div className="state-view-actions">
        {retry && <Button onClick={retry}>Retry</Button>}
        {signIn && (
          <Button variant="light" onClick={signIn}>
            Sign in
          </Button>
        )}
      </div>
    </main>
  );
}
