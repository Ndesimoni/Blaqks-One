import React from 'react';
import { Button } from '../../components/ui/Button.jsx';
import { SignupShell } from './SignupShell.jsx';

export function SignupState({ title, body, action, onAction, loading = false, ltr = false }) {
  return (
    <SignupShell>
      <div className={loading ? 'signup-state loading' : 'signup-state'} aria-busy={loading}>
        <h1>{title}</h1>
        <p className={ltr ? 'u-ltr' : ''}>{body}</p>
        {action && (
          <Button className="signup-primary" onClick={onAction}>
            {action}
          </Button>
        )}
      </div>
    </SignupShell>
  );
}
