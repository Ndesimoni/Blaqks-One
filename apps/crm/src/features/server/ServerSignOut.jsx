import React, { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../hooks/useSession.js';
import { useUnsavedChanges } from '../../hooks/useUnsavedChanges.js';
import { ServerStatus } from './ServerStatus.jsx';

export function ServerSignOut() {
  const { signOut } = useSession();
  const go = useNavigate();
  const started = useRef(false);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useUnsavedChanges(false, !error);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    signOut()
      .then(() => go('/clients', { replace: true }))
      .catch((failure) => setError(failure.message));
  }, [signOut, go, attempt]);
  return (
    <ServerStatus
      title="Signing out"
      message={error || 'Closing your session…'}
      retry={
        error
          ? () => {
              started.current = false;
              setError('');
              setAttempt((value) => value + 1);
            }
          : undefined
      }
    />
  );
}
