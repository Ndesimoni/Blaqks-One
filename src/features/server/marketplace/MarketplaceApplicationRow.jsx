import React, { useState } from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { MarketplaceDecision } from './MarketplaceDecision.jsx';

/**
 * One application in the platform queue: the company, who applied, when, the counts behind
 * the checklist, and the decision buttons the company's state allows.
 */
export function MarketplaceApplicationRow({ row, onChanged }) {
  const { t, format } = useI18n();
  const [action, setAction] = useState('');
  const pending = row.state === 'pending';
  const counts = row.counts;
  return (
    <li className="market-application">
      <div className="market-application-head">
        <div>
          <strong>{row.company || t('marketplace.applications.unnamed')}</strong>
          <span className="market-detail">
            {t(`marketplace.applications.accountType.${row.accountType}`)} ·{' '}
            {format.date(row.companyCreatedAt) || row.companyCreatedAt}
          </span>
        </div>
        <Badge>{t(`marketplace.states.${row.state}`)}</Badge>
      </div>
      <p className="market-detail">
        {t('marketplace.applications.applied', {
          name: row.appliedBy || t('marketplace.applications.someone'),
          date: format.dateTime(row.appliedAt) || row.appliedAt,
        })}
      </p>
      <p className="market-counts">
        {t('marketplace.applications.counts', {
          days: counts.ageDays,
          properties: counts.properties,
          clients: counts.clients,
          contacts: counts.contacts,
          followUps: counts.followUps,
          viewings: counts.viewings,
        })}
      </p>
      {row.reason && pending === false && (
        <p className="market-reason">
          <span>{t(`marketplace.states.${row.state}`)}</span> {row.reason}
        </p>
      )}
      <div className="market-actions">
        {pending && (
          <>
            <Button onClick={() => setAction('approved')}>
              {t('marketplace.applications.approve')}
            </Button>
            <Button variant="danger-light" onClick={() => setAction('declined')}>
              {t('marketplace.applications.decline')}
            </Button>
          </>
        )}
        {row.state === 'approved' && (
          <Button variant="danger-light" onClick={() => setAction('revoked')}>
            {t('marketplace.applications.revoke')}
          </Button>
        )}
      </div>
      {action && (
        <MarketplaceDecision
          row={row}
          action={action}
          onClose={() => setAction('')}
          onDecided={() => {
            setAction('');
            onChanged();
          }}
        />
      )}
    </li>
  );
}
