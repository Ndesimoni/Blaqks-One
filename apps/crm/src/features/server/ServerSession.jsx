import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SessionContext } from '../../app/SessionContext.js';
import { GuidanceProvider } from '../../app/GuidanceContext.jsx';
import { createCrmClient } from '../../services/crm/client.js';
import { ServerStatus } from './ServerStatus.jsx';
import { ServerSignIn } from './ServerSignIn.jsx';
import { useLocation } from 'react-router-dom';
import { InvitationActivation } from '../server-team/InvitationActivation.jsx';
import { useAccountLanguage } from './useAccountLanguage.js';
import { SignupPage } from '../signup/SignupPage.jsx';
import { useI18n } from '../../i18n/useI18n.js';

export function ServerSession({ children }) {
  const location = useLocation();
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [notice, setNotice] = useState('');
  const api = useMemo(
    () =>
      createCrmClient(undefined, (path) => {
        setUser(null);
        setCompany(null);
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
  useAccountLanguage(user?.language);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api
      .sessionWithCompany(controller.signal)
      .then((session) => {
        setUser(session.user);
        setCompany(session.company);
      })
      .catch((failure) => {
        if (failure.name === 'AbortError') return;
        setUser(null);
        setCompany(null);
        if (failure.status !== 401) setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, attempt]);
  const signIn = useCallback(
    async (email, password) => {
      const session = await api.loginWithCompany(email, password);
      setUser(session.user);
      setCompany(session.company);
      setError('');
      setNotice('');
    },
    [api],
  );
  const signOut = useCallback(async () => {
    await api.logout();
    setUser(null);
    setCompany(null);
  }, [api]);
  // My profile installs the saved profile after a name, phone or language change.
  const replaceUser = useCallback((profile) => setUser(profile), []);
  const replaceCompany = useCallback((profile) => setCompany(profile), []);
  const installSignupUser = useCallback((profile) => {
    setUser(profile);
    setCompany(null);
  }, []);
  useEffect(() => {
    if (!user || company || location.pathname === '/sign-up') return;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    api
      .company(user.workspaceId, controller.signal)
      .then(setCompany)
      .catch((failure) => {
        if (failure.name !== 'AbortError') setError(failure.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) setLoading(false);
      });
    return () => controller.abort();
  }, [api, user, company, location.pathname]);
  const value = useMemo(
    () => ({ user, company, api, signIn, signOut, replaceUser, replaceCompany }),
    [user, company, api, signIn, signOut, replaceUser, replaceCompany],
  );
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
  if (location.pathname === '/sign-up')
    return <SignupPage api={api} user={user} onVerified={installSignupUser} onSignOut={signOut} />;
  if (!user) return <ServerSignIn api={api} signIn={signIn} notice={notice} />;
  if (!company)
    return (
      <ServerStatus
        title={t('signupSetup.openingTitle')}
        message={t('signupSetup.openingBody')}
        retry={() => setAttempt((value) => value + 1)}
        signIn={signOut}
      />
    );
  return (
    <SessionContext.Provider value={value}>
      <GuidanceProvider enabled={user.guidanceEnabled}>{children}</GuidanceProvider>
    </SessionContext.Provider>
  );
}
