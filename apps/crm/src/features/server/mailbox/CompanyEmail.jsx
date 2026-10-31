import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

/**
 * The member's address on the company's SendGrid domain (E3d). The Admin gives it on
 * Channels; members never choose a From address, so there is no action here.
 */
export function CompanyEmail({ company, mayConnect }) {
  const { t } = useI18n();
  const state = !mayConnect
    ? 'none'
    : !company.connected
      ? 'attention'
      : company.address
        ? 'ready'
        : 'none';
  const tone = state === 'ready' ? 'green' : state === 'attention' ? 'amber' : 'slate';
  return (
    <article className="mailbox-card" aria-labelledby="company-email-title">
      <header className="mailbox-head">
        <span className="mailbox-icon" aria-hidden="true">
          <Icon name="note" size={20} />
        </span>
        <div>
          <h2 id="company-email-title">{t('mailbox.company.title')}</h2>
          <p>{t('mailbox.company.provider')}</p>
        </div>
        <Badge tone={tone}>{t(`mailbox.company.badge.${state}`)}</Badge>
      </header>
      {!mayConnect ? (
        <p className="mailbox-muted">{t('mailbox.noAccess')}</p>
      ) : company.address ? (
        <div className="mailbox-address">
          <span>{t('mailbox.company.label')}</span>
          <strong className="u-ltr">
            <bdi>{company.address}</bdi>
          </strong>
          <small>{t('mailbox.company.shownAs', { name: company.displayName })}</small>
        </div>
      ) : (
        <p className="mailbox-muted">{t('mailbox.company.none')}</p>
      )}
      {mayConnect && !company.connected && (
        <p className="mailbox-muted" role="status">
          {t('mailbox.company.attention')}
        </p>
      )}
      {mayConnect && company.address && <p className="mailbox-what">{t('mailbox.company.what')}</p>}
      <p className="mailbox-muted mailbox-note">{t('mailbox.company.noGoogle')}</p>
    </article>
  );
}
