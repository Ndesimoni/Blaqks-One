import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SessionContext } from '../../app/SessionContext.js';
import { GuidanceProvider } from '../../app/GuidanceContext.jsx';
import { BootSplash } from '../../components/layout/BootSplash.jsx';
import { createCrmClient } from '../../services/crm/client.js';
import { ServerStatus } from './ServerStatus.jsx';
import { Navigate, useLocation } from 'react-router-dom';
import { SIGN_IN, afterSignIn, isSignUpPath } from '../auth/authPaths.js';
import { SignInGate } from '../auth/SignInGate.jsx';
import { InvitationActivation } from '../server-team/InvitationActivation.jsx';
import { useAccountLanguage } from './useAccountLanguage.js';
import { useSignOut } from './useSignOut.js';
import { useSessionCheck } from './useSessionCheck.js';
import { useWorkspacePreload } from './workspaceLoader.js';
import { SignupPage } from '../signup/SignupPage.jsx';
import { useI18n } from '../../i18n/useI18n.js';

const ACCOUNT_PAGES = [SIGN_IN, '/activate-invitation'];

export function ServerSession({ children }) {
  const location = useLocation();
  const { t } = useI18n();
  const [user, setUser] = useState(null);
  const [company, setCompany] = useState(null);
  const [notice, setNotice] = useState('');
  const api = useMemo(
    () =>
      createCrmClient(undefined, (path) => {
        // The opening check's 401 means "signed out", never "signed out just now".
        if (path === '/auth/session') return;
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
  const clearSession = useCallback(() => {
    setUser(null);
    setCompany(null);
  }, []);
  const { leaving, signOut } = useSignOut(api, clearSession);
  useWorkspacePreload();
  // My profile installs the saved profile after a name, phone or language change.
  const replaceUser = useCallback((profile) => setUser(profile), []);
  const replaceCompany = useCallback((profile) => setCompany(profile), []);
  // The opening check, and joining from an invitation, install a person with their company.
  const installSession = useCallback((session) => {
    setUser(session.user);
    setCompany(session.company);
    setNotice('');
  }, []);
  useSessionCheck(api, attempt, { install: installSession, setLoading, setError });
  const installSignupUser = useCallback((profile) => {
    setUser(profile);
    setCompany(null);
  }, []);
  useEffect(() => {
    if (!user || company || isSignUpPath(location.pathname)) return;
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
  // Account pages show at once while the check runs; a signed-in person then moves on.
  const accountPage = ACCOUNT_PAGES.includes(location.pathname) || isSignUpPath(location.pathname);
  if (leaving || (loading && !accountPage)) return <BootSplash />;
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
    return (
      <InvitationActivation
        api={api}
        signedIn={!!user}
        onJoined={installSession}
        onSignOut={signOut}
      />
    );
  if (isSignUpPath(location.pathname))
    return <SignupPage api={api} user={user} onVerified={installSignupUser} onSignOut={signOut} />;
  if (!user) return <SignInGate api={api} signIn={signIn} notice={notice} />;
  if (!company)
    return (
      <ServerStatus
        title={t('signupSetup.openingTitle')}
        message={t('signupSetup.openingBody')}
        retry={() => setAttempt((value) => value + 1)}
        signIn={signOut}
      />
    );
  // Signed in at the sign-in address: on to the page that was asked for.
  if (location.pathname === SIGN_IN) return <Navigate replace to={afterSignIn(location.search)} />;
  return (
    <SessionContext.Provider value={value}>
      <GuidanceProvider enabled={user.guidanceEnabled}>{children}</GuidanceProvider>
    </SessionContext.Provider>
  );
}
