import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button.jsx';
import { useI18n } from '../../i18n/useI18n.js';
import { SIGN_IN } from '../auth/authPaths.js';
import { AuthShell } from '../auth/AuthShell.jsx';
import { invitationIntro, invitationTitle } from './invitationModel.js';
import { InvitationPasswordForm } from './InvitationPasswordForm.jsx';

/**
 * Joining a team from an invitation link, as the approved mockup's full-screen split screen
 * (design queue item 34): the company to join, who invited you and as what, then a password.
 * Joining signs the person in and opens their workspace (`onJoined` installs the session).
 */
export function InvitationActivation({ api, signedIn, onJoined }) {
  const { t } = useI18n();
  const location = useLocation();
  const go = useNavigate();
  const token = new URLSearchParams(location.search).get('token') || '';
  const [invitation, setInvitation] = useState(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [complete, setComplete] = useState(false);
  useEffect(() => {
    if (signedIn) return;
    const controller = new AbortController();
    setInvitation(null);
    setError('');
    if (!token) {
      setError(t('auth.invite.incomplete'));
      return;
    }
    api
      .inspectInvitation(token, controller.signal)
      .then((result) => {
        if (!result.invitation?.email) throw Error(t('auth.invite.unopened'));
        if (!controller.signal.aborted) setInvitation(result.invitation);
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError') setError(failure.message);
      });
    return () => controller.abort();
  }, [api, token, attempt, signedIn, t]);
  const toSignIn = () => go(SIGN_IN, { replace: true });
  // Once joined and signed in, open the workspace (after the form, and its guard, are gone).
  useEffect(() => {
    if (complete && signedIn) go('/', { replace: true });
  }, [complete, signedIn, go]);
  // Checked first: joining signs the person in, which the page sees before it moves on.
  if (complete)
    return (
      <AuthShell busy>
        <h1>{t('auth.invite.doneTitle')}</h1>
        <p role="status">{t('auth.invite.opening')}</p>
      </AuthShell>
    );
  if (signedIn)
    return (
      <AuthShell>
        <h1>{t('auth.invite.signedInTitle')}</h1>
        <p>{t('auth.invite.signedIn')}</p>
        <Button className="auth-submit" onClick={() => go('/sign-out')}>
          {t('auth.invite.signOut')}
        </Button>
      </AuthShell>
    );
  return (
    <AuthShell busy={!invitation && !error}>
      <h1>{invitationTitle(invitation, t)}</h1>
      {error ? (
        <>
          <p className="field-error" role="alert">
            {error}
          </p>
          <Button variant="light" onClick={() => setAttempt((value) => value + 1)}>
            {t('auth.invite.retry')}
          </Button>
          <Button className="auth-submit" onClick={toSignIn}>
            {t('auth.invite.goSignIn')}
          </Button>
        </>
      ) : !invitation ? (
        <p role="status">{t('auth.invite.checking')}</p>
      ) : (
        <>
          <p>{invitationIntro(invitation, t)}</p>
          <InvitationPasswordForm
            invitation={invitation}
            onAccept={(password) => api.acceptInvitation(token, password)}
            onComplete={(session) => {
              setComplete(true);
              onJoined(session);
            }}
          />
        </>
      )}
    </AuthShell>
  );
}
