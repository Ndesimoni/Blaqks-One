import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { useWebsiteProfile } from './useWebsiteProfile.js';
import { WebsiteProfileSectionForm } from './WebsiteProfileSectionForm.jsx';
import './profile-cards.css';
import './profile.css';
import './website-profile-section.css';

/**
 * My profile → Website profile (design queue item 14), for the company Admin and staff who can
 * open Properties (the server's rule for an agent profile; the route is gated the same way).
 * The Super Admin has no company website profile.
 */
export function ServerWebsiteProfile() {
  const { t } = useI18n();
  const { api, user } = useSession();
  const own = useWebsiteProfile(api, user.workspaceId || user.id, user.id);
  if (own.error && own.profile === undefined)
    return (
      <section className="panel recovery-panel" role="alert">
        <p className="field-error">{own.error}</p>
        <Button variant="light" onClick={own.reload}>
          {t('websiteTeam.retry')}
        </Button>
      </section>
    );
  if (own.loading)
    return (
      <div className="panel profile-card acct-card-body wp-skeleton">
        <p className="sr-only" role="status">
          {t('websiteTeam.own.loading')}
        </p>
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </div>
    );
  return (
    <WebsiteProfileSectionForm
      own={own}
      admin={user.roleId === 'admin'}
      fallbackName={user.name}
      t={t}
    />
  );
}
