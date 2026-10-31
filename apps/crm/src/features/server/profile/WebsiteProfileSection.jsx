import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { SettingsSection } from './SettingsSection.jsx';
import { useWebsiteProfile } from './useWebsiteProfile.js';
import { WebsiteProfileSectionForm } from './WebsiteProfileSectionForm.jsx';
import './website-profile-section.css';

function WebsiteProfileBody({ api, user, t }) {
  const own = useWebsiteProfile(api, user.workspaceId || user.id, user.id);
  if (own.error && own.profile === undefined)
    return (
      <div className="panel acct-card acct-card-body" role="alert">
        <p className="field-error">{own.error}</p>
        <Button variant="light" onClick={own.reload}>
          {t('websiteTeam.retry')}
        </Button>
      </div>
    );
  if (own.loading)
    return (
      <div className="panel acct-card acct-card-body wp-skeleton">
        <p className="sr-only" role="status">
          {t('websiteTeam.own.loading')}
        </p>
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </div>
    );
  return (
    <div className="panel acct-card">
      <WebsiteProfileSectionForm
        own={own}
        admin={user.roleId === 'admin'}
        fallbackName={user.name}
        t={t}
      />
    </div>
  );
}

/**
 * My profile → Website profile, for the company Admin and staff who can open Properties (the
 * server's rule for an agent profile). The Super Admin has no company website profile.
 */
export function WebsiteProfileSection({ api, user }) {
  const { t } = useI18n();
  const eligible =
    user?.roleId === 'admin' || (user?.roleId === 'staff' && user.permissions?.properties === true);
  if (!eligible) return null;
  return (
    <SettingsSection
      id="website-profile"
      title={t('websiteTeam.own.title')}
      description={t('websiteTeam.own.description')}
    >
      <WebsiteProfileBody api={api} user={user} t={t} />
    </SettingsSection>
  );
}
