import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '../../components/ui/Button.jsx';
import { ServerTheme } from '../server/ServerTheme.jsx';
import { InvitationPasswordForm } from './InvitationPasswordForm.jsx';

export function InvitationActivation({ api, signedIn }) {
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
      setError('This invitation link is incomplete. Ask your Admin for a new link.');
      return;
    }
    api
      .inspectInvitation(token, controller.signal)
      .then((result) => {
        if (!result.invitation?.email)
          throw Error('The invitation could not be opened. Ask your Admin for a new link.');
        if (!controller.signal.aborted) setInvitation(result.invitation);
      })
      .catch((failure) => {
        if (failure.name !== 'AbortError') setError(failure.message);
      });
    return () => controller.abort();
  }, [api, token, attempt, signedIn]);
  return (
    <main className="sign-in-page">
      <section className="panel team-standalone-wizard" aria-labelledby="activation-title">
        <div className="drawer-top">
          <div>
            <h1 id="activation-title">{complete ? 'Account activated' : 'Join your team'}</h1>
            <p>Keys with Simoni</p>
          </div>
          <ServerTheme />
        </div>
        <div className="drawer-body team-fields">
          {signedIn ? (
            <>
              <p>Sign out of your current account before activating this invitation.</p>
              <Button onClick={() => go('/sign-out')}>Sign out</Button>
            </>
          ) : complete ? (
            <>
              <p>
                Your account is ready. Sign in with {invitation.email} and the password you chose.
              </p>
              <Button onClick={() => go('/', { replace: true })}>Go to sign in</Button>
            </>
          ) : error ? (
            <>
              <p className="field-error" role="alert">
                {error}
              </p>
              <Button variant="light" onClick={() => setAttempt((value) => value + 1)}>
                Retry
              </Button>
              <Button onClick={() => go('/', { replace: true })}>Go to sign in</Button>
            </>
          ) : !invitation ? (
            <p role="status">Checking invitation…</p>
          ) : (
            <>
              <h2>Welcome, {invitation.name}</h2>
              <p>Invited by {invitation.ownerName}.</p>
              <dl className="connected-team-review">
                <dt>Email</dt>
                <dd>{invitation.email}</dd>
                <dt>Phone</dt>
                <dd>{invitation.phone}</dd>
                <dt>Account</dt>
                <dd>{invitation.roleId === 'admin' ? 'Admin · Own workspace' : 'Teammate'}</dd>
              </dl>
              <p>Expires {new Date(invitation.expiresAt).toLocaleString()}.</p>
              <InvitationPasswordForm
                email={invitation.email}
                onAccept={(password) => api.acceptInvitation(token, password)}
                onComplete={() => setComplete(true)}
              />
            </>
          )}
        </div>
      </section>
    </main>
  );
}
