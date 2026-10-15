import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useWorkspaceScope } from '../../../hooks/useWorkspaceScope.js';
import { AccountSummary } from './AccountSummary.jsx';
import { PasswordForm } from './PasswordForm.jsx';
import { ProfileDetailsForm } from './ProfileDetailsForm.jsx';
import { ProfileSkeleton } from './ProfileSkeleton.jsx';
import { ProfileHeader } from './ProfileHeader.jsx';
import { SessionsPanel } from './SessionsPanel.jsx';
import { SettingsSection } from './SettingsSection.jsx';
import { useAccount } from './useAccount.js';
import { useSessions } from './useSessions.js';
import './profile.css';
import './profile-header.css';
import './profile-forms.css';
import './profile-sessions.css';

/**
 * Connected My profile (docs/account-self-service.md): the member's own account, name and phone,
 * password and sign-in sessions. It never reads workspace records and grants no extra powers.
 */
export function ServerProfile() {
  const { api, replaceUser } = useSession();
  const { refreshDirectory } = useWorkspaceScope();
  const { account, error, reload, replace } = useAccount(api);
  const sessions = useSessions(api);
  if (error)
    return (
      <section className="panel recovery-panel" role="alert">
        <p className="field-error">{error}</p>
        <Button onClick={reload}>Retry</Button>
      </section>
    );
  if (!account) return <ProfileSkeleton />;
  const onSaved = (next) => {
    replace(next);
    replaceUser(next.user);
    refreshDirectory();
  };
  const onPasswordChanged = () => {
    reload();
    sessions.reload();
  };
  return (
    <div className="page-stack acct-page">
      <ProfileHeader account={account} />
      <div className="acct-sections">
        <SettingsSection
          id="account"
          title="Account details"
          description="How you sign in and what you can access."
        >
          <AccountSummary account={account} />
        </SettingsSection>
        <SettingsSection
          id="details"
          title="Edit details"
          description="Your name and phone number as your team sees them."
        >
          <div className="panel acct-card">
            <ProfileDetailsForm api={api} account={account} onSaved={onSaved} onReload={reload} />
          </div>
        </SettingsSection>
        <SettingsSection
          id="password"
          title="Change password"
          description="Use a strong password that you do not use anywhere else."
        >
          <div className="panel acct-card">
            <PasswordForm
              api={api}
              email={account.user.email}
              onChanged={onPasswordChanged}
              onReload={reload}
            />
          </div>
        </SettingsSection>
        <SettingsSection
          id="sessions"
          title="Active sessions"
          description="Devices that are signed in to your account. Sign out any you do not recognise."
        >
          <SessionsPanel state={sessions} />
        </SettingsSection>
      </div>
    </div>
  );
}
