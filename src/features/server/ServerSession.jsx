import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SessionContext } from '../../app/SessionContext.js';
import { createCrmClient } from '../../services/crm/client.js';
import { ServerStatus } from './ServerStatus.jsx';
import { ServerSignIn } from './ServerSignIn.jsx';
import { useLocation } from 'react-router-dom';
import { InvitationActivation } from '../server-team/InvitationActivation.jsx';

export function ServerSession({ children }) {
  const location = useLocation();
  const [user, setUser] = useState(null);
  const [notice, setNotice] = useState('');
  const api = useMemo(
    () =>
      createCrmClient(undefined, (path) => {
        setUser(null);
        if (path !== '/auth/session')
          setNotice(
            'Your session has ended. Sign in again to continue. Unsaved changes were not saved.',
          );
      }),
    [],
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api
      .session(controller.signal)
      .then(setUser)
      .catch((failure) => {
        if (failure.name === 'AbortError') return;
        setUser(null);
        if (failure.status !== 401) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, attempt]);
  const signIn = useCallback(
    async (email, password) => {
      const profile = await api.login(email, password);
      setUser(profile);
      setError('');
      setNotice('');
    },
    [api],
  );
  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
  }, [api]);
  const value = useMemo(() => ({ user, api, signIn, signOut }), [user, api, signIn, signOut]);
  if (loading) return <ServerStatus title="Opening your CRM" message="Checking your account…" />;
  if (error)
    return (
      <ServerStatus
        title="Unable to open the CRM"
        message={error}
        retry={() => setAttempt((value) => value + 1)}
        signIn={() => setError('')}
      />
    );
  if (location.pathname === '/activate-invitation')
    return <InvitationActivation api={api} signedIn={!!user} />;
  if (!user) return <ServerSignIn signIn={signIn} notice={notice} />;
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
