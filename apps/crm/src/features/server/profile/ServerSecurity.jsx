import React from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { AccountGate } from './AccountGate.jsx';
import { PasswordForm } from './PasswordForm.jsx';
import { ProfileCard } from './ProfileCard.jsx';
import { formatStamp } from './profileModel.js';
import { relativeTime } from './sessionModel.js';
import { SessionsPanel } from './SessionsPanel.jsx';
import { useSessions } from './useSessions.js';
import './profile-cards.css';
import './profile-forms.css';
import './profile-sessions.css';
import './profile.css';

/** When the password last changed, as the earlier profile header showed it. */
function PasswordAge({ changedAt }) {
  if (!changedAt) return <p className="acct-muted">Not changed since your account was set up.</p>;
  return (
    <p className="acct-muted" title={formatStamp(changedAt)}>
      Last changed {relativeTime(changedAt)}
    </p>
  );
}

/**
 * My profile → Sign-in and security (design queue item 14): the password and the signed-in
 * devices, kept from the earlier My profile page on a header tab of their own, since the
 * approved mockup's Profile tab holds only the member's details.
 */
export function ServerSecurity() {
  const { api } = useSession();
  const sessions = useSessions(api);
  return (
    <AccountGate>
      {({ account, reload }) => (
        <div className="page-stack acct-page profile-grid">
          <ProfileCard
            id="password"
            title="Change password"
            description="Use a strong password that you do not use anywhere else."
          >
            <div className="profile-card-note">
              <PasswordAge changedAt={account.passwordChangedAt} />
            </div>
            <div className="acct-card">
              <PasswordForm
                api={api}
                email={account.user.email}
                onChanged={() => {
                  reload();
                  sessions.reload();
                }}
                onReload={reload}
              />
            </div>
          </ProfileCard>
          <ProfileCard
            id="sessions"
            title="Active sessions"
            description="Devices that are signed in to your account. Sign out any you do not recognise."
          >
            <SessionsPanel state={sessions} />
          </ProfileCard>
        </div>
      )}
    </AccountGate>
  );
}
