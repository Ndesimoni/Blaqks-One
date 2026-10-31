import React from 'react';
import { Button } from '../../components/ui/Button.jsx';

export function ServerStatus({ title, message, retry, signIn }) {
  return (
    <main className="session-status">
      <h1>{title}</h1>
      <p role={retry ? 'alert' : 'status'}>{message}</p>
      {retry && <Button onClick={retry}>Retry</Button>}
      {signIn && (
        <Button variant="light" onClick={signIn}>
          Sign in
        </Button>
      )}
    </main>
  );
}
