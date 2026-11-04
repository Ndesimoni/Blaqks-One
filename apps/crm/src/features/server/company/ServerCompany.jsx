import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { ProfileCard } from '../profile/ProfileCard.jsx';
import '../profile/profile-cards.css';
import '../profile/profile-sessions.css';
import '../profile/profile.css';
import { CompanyFields } from './CompanyFields.jsx';
import { CompanyMarketplace } from './CompanyMarketplace.jsx';
import { CompanyPlan } from './CompanyPlan.jsx';
import './company.css';
import { useCompanyForm } from './useCompanyForm.js';

/**
 * Settings → Company as the approved mockup (design queue item 15), for the company Admin: its
 * details with a save bar, beside the marketplace switch and the plan and seats.
 */
export function ServerCompany() {
  const { t } = useI18n();
  const { company } = useSession();
  const form = useCompanyForm();
  return (
    <form className="page-stack acct-page company-page" onSubmit={form.save} noValidate>
      <div className="company-grid">
        <ProfileCard
          id="company-details"
          title={t('company.title')}
          description={t('company.description')}
        >
          <CompanyFields form={form} />
        </ProfileCard>
        <div className="company-side">
          <CompanyMarketplace />
          <CompanyPlan />
        </div>
      </div>
      {form.failure && (
        <div className="acct-alert" role="alert">
          <p className="field-error">{form.failure}</p>
        </div>
      )}
      <div className="panel profile-save-bar">
        <div className="acct-card-foot">
          <div className="acct-foot-status" aria-live="polite">
            {form.status ? (
              <p className="acct-success">
                <Icon name="check" size={15} />
                {form.status}
              </p>
            ) : (
              <p className="acct-muted">
                {form.changed
                  ? t('company.unsaved')
                  : t('company.version', { version: company.version })}
              </p>
            )}
          </div>
          <div className="acct-actions">
            <Button variant="light" disabled={form.busy || !form.changed} onClick={form.discard}>
              {t('company.discard')}
            </Button>
            <Button type="submit" disabled={form.busy || !form.changed} aria-busy={form.busy}>
              {form.busy ? t('company.saving') : t('company.save')}
            </Button>
          </div>
        </div>
      </div>
    </form>
  );
}
