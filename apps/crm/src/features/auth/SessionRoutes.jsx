import React, { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { useSession } from '../../hooks/useSession.js';
import { Button } from '../../components/ui/Button.jsx';
import { SignInPage } from './SignInPage.jsx';

export function RequireSession({ children }) {
  const { user } = useSession();
  return user ? children : <Navigate to="/sign-in" replace />;
}

export function SignInRoute() {
  const { user } = useSession();
  return user ? <Navigate to="/" replace /> : <SignInPage />;
}

// A route change lets the existing unsaved-form blocker run before clearing identity.
export function SignOutRoute() {
  const { user, signOut } = useSession();
  const [error, setError] = useState('');
  useEffect(() => {
    if (!user) return;
    try {
      signOut();
    } catch (failure) {
      setError(failure.message);
    }
  }, [user, signOut]);
  if (!user) return <Navigate to="/sign-in" replace />;
  return (
    <main className="session-status">
      <h1>{error ? 'Sign out could not be completed' : 'Signing out…'}</h1>
      {error && (
        <>
          <p role="alert">{error}</p>
          <Button
            onClick={() => {
              try {
                signOut();
              } catch (failure) {
                setError(failure.message);
              }
            }}
          >
            Try signing out again
          </Button>
          <Link to="/">Return to dashboard</Link>
        </>
      )}
    </main>
  );
}
