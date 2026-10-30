import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useWorkspaceScope } from '../../../hooks/useWorkspaceScope.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { AccountSummary } from './AccountSummary.jsx';
import { CompanyProfileForm } from './CompanyProfileForm.jsx';
import { GuidanceSetting } from './GuidanceSetting.jsx';
import { LanguageSetting } from './LanguageSetting.jsx';
import { PasswordForm } from './PasswordForm.jsx';
import './profile-forms.css';
import './profile-header.css';
import './profile-language.css';
import './profile-sessions.css';
import './profile.css';
import { ProfileDetailsForm } from './ProfileDetailsForm.jsx';
import { ProfileHeader } from './ProfileHeader.jsx';
import { ProfileSkeleton } from './ProfileSkeleton.jsx';
import { SessionsPanel } from './SessionsPanel.jsx';
import { SettingsSection } from './SettingsSection.jsx';
import { useAccount } from './useAccount.js';
import { useSessions } from './useSessions.js';
import { WebsiteProfileSection } from './WebsiteProfileSection.jsx';
/**
 * Connected My profile (docs/account-self-service.md): the member's own account, name and phone,
 * language, website profile, password and sign-in sessions. It never reads CRM records (the
 * website section counts only live listings) and grants no extra powers (docs/i18n.md).
 */
export function ServerProfile() {
  const { api, user, company, replaceUser, replaceCompany } = useSession();
  const { refreshDirectory } = useWorkspaceScope();
  const { t, languages } = useI18n();
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
  const onPreferenceSaved = (next) => {
    replace(next);
    replaceUser(next.user);
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
        {user.roleId === 'admin' && (
          <SettingsSection
            id="company-profile"
            title={t('signupSetup.companyProfileTitle')}
            description={t('signupSetup.companyProfileDescription')}
          >
            <CompanyProfileForm
              api={api}
              workspaceId={user.workspaceId}
              company={company}
              onSaved={replaceCompany}
            />
          </SettingsSection>
        )}
        <SettingsSection
          id="details"
          title="Edit details"
          description="Your name and phone number as your team sees them."
        >
          <div className="panel acct-card">
            <ProfileDetailsForm api={api} account={account} onSaved={onSaved} onReload={reload} />
          </div>
        </SettingsSection>
        <WebsiteProfileSection api={api} user={user} />
        {languages.length > 1 && (
          <SettingsSection
            id="language"
            title={t('profile.language.title')}
            description={t('profile.language.description')}
          >
            <LanguageSetting api={api} account={account} onSaved={onPreferenceSaved} />
          </SettingsSection>
        )}
        <SettingsSection
          id="guidance"
          title={t('profile.guidance.title')}
          description={t('profile.guidance.description')}
        >
          <GuidanceSetting api={api} account={account} onSaved={onPreferenceSaved} />
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
