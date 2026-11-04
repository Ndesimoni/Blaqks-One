import React from 'react';
import { useSession } from '../../../hooks/useSession.js';
import { useWorkspaceScope } from '../../../hooks/useWorkspaceScope.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { AccountGate } from './AccountGate.jsx';
import { AccountSummary } from './AccountSummary.jsx';
import { CompanyProfileForm } from './CompanyProfileForm.jsx';
import { GuidanceSetting } from './GuidanceSetting.jsx';
import { LanguageSetting } from './LanguageSetting.jsx';
import { ProfileCard } from './ProfileCard.jsx';
import { ProfileDetailsForm } from './ProfileDetailsForm.jsx';
import './account-list.css';
import './profile-cards.css';
import './profile-forms.css';
import './profile-language.css';
import './profile.css';

/**
 * Connected My profile → Profile (docs/account-self-service.md, design queue item 14): the
 * member's name and phone first, as the approved mockup's form, then language, the account's
 * read-only facts and field guidance. Website profile and Sign-in and security are its other
 * header tabs. It never reads CRM records and grants no extra powers (docs/i18n.md).
 */
export function ServerProfile() {
  const { api, user, company, replaceUser, replaceCompany } = useSession();
  const { refreshDirectory } = useWorkspaceScope();
  const { t, languages } = useI18n();
  return (
    <AccountGate>
      {({ account, reload, replace }) => {
        const onSaved = (next) => {
          replace(next);
          replaceUser(next.user);
          refreshDirectory();
        };
        const onPreferenceSaved = (next) => {
          replace(next);
          replaceUser(next.user);
        };
        return (
          <div className="page-stack acct-page profile-grid">
            <ProfileCard
              id="details"
              title="Your details"
              description="Your name and phone number as your team sees them."
            >
              <div className="acct-card">
                <ProfileDetailsForm
                  api={api}
                  account={account}
                  onSaved={onSaved}
                  onReload={reload}
                />
              </div>
            </ProfileCard>
            <ProfileCard
              id="account"
              title="Account details"
              description="How you sign in and what you can access."
            >
              <AccountSummary account={account} />
            </ProfileCard>
            {languages.length > 1 && (
              <ProfileCard
                id="language"
                title={t('profile.language.title')}
                description={t('profile.language.description')}
              >
                <LanguageSetting api={api} account={account} onSaved={onPreferenceSaved} />
              </ProfileCard>
            )}
            <ProfileCard
              id="guidance"
              title={t('profile.guidance.title')}
              description={t('profile.guidance.description')}
            >
              <GuidanceSetting api={api} account={account} onSaved={onPreferenceSaved} />
            </ProfileCard>
            {user.roleId === 'admin' && (
              <ProfileCard
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
              </ProfileCard>
            )}
          </div>
        );
      }}
    </AccountGate>
  );
}
