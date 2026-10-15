import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useWorkspaceScope } from '../../../hooks/useWorkspaceScope.js';
import { AccountSummary } from './AccountSummary.jsx';
import { PasswordForm } from './PasswordForm.jsx';
import { ProfileDetailsForm } from './ProfileDetailsForm.jsx';
import { SessionsPanel } from './SessionsPanel.jsx';
import { useAccount } from './useAccount.js';
import { useSessions } from './useSessions.js';
import './profile.css';

/**
 * Connected My profile (docs/account-self-service.md): the member's own account, name and phone,
 * password and sign-in sessions. It never reads workspace records and grants no extra powers.
 */
export function ServerProfile() {
  const { api, replaceUser } = useSession();
  const { refreshDirectory } = useWorkspaceScope();
  const { account, error, reload, replace } = useAccount(api);
  const sessions = useSessions(api);
  const [saved, setSaved] = useState('');
  if (error)
    return (
      <section className="panel recovery-panel" role="alert">
        <p className="field-error">{error}</p>
        <Button onClick={reload}>Retry</Button>
      </section>
    );
  if (!account) return <p role="status">Loading your account…</p>;
  const onSaved = (next) => {
    replace(next);
    replaceUser(next.user);
    refreshDirectory();
    setSaved('Your details were saved.');
  };
  const onPasswordChanged = () => {
    reload();
    sessions.reload();
  };
  return (
    <div className="page-stack profile-page">
      <div className="profile-grid">
        <AccountSummary account={account} />
        <div className="profile-column">
          <ProfileDetailsForm
            key={account.version}
            api={api}
            account={account}
            onSaved={onSaved}
            onReload={() => {
              setSaved('');
              reload();
            }}
          />
          <div aria-live="polite" className="profile-status">
            {saved && <p className="profile-success">{saved}</p>}
          </div>
        </div>
      </div>
      <PasswordForm
        api={api}
        email={account.user.email}
        onChanged={onPasswordChanged}
        onReload={reload}
      />
      <SessionsPanel state={sessions} />
    </div>
  );
}
