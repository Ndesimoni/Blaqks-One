import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { MarketplaceApplyButton } from './MarketplaceApplyButton.jsx';
import { MarketplaceChecklist } from './MarketplaceChecklist.jsx';

/**
 * Waiting on the platform (broker marketplace §15): pending, declined with its reason and
 * the day the company may apply again, or revoked.
 */
export function MarketplaceWaiting({ company, admin, onChanged }) {
  const { t, format } = useI18n();
  const { state, declineReason, canApplyFrom, checklist } = company;
  const waited = !canApplyFrom || Date.parse(canApplyFrom) <= Date.now();
  const again =
    state === 'declined' && canApplyFrom ? format.date(canApplyFrom) || canApplyFrom : '';
  return (
    <section className="market-card">
      <h3>{t(`marketplace.waiting.${state}.title`)}</h3>
      {state === 'pending' && <p>{t('marketplace.waiting.pending.text')}</p>}
      {state === 'revoked' && <p>{t('marketplace.waiting.revoked.text')}</p>}
      {state === 'declined' && (
        <>
          <p>{t('marketplace.waiting.declined.text')}</p>
          {declineReason && (
            <p className="market-reason">
              <span>{t('marketplace.waiting.declined.reason')}</span> {declineReason}
            </p>
          )}
          <p className="market-hint">
            {waited
              ? t('marketplace.waiting.declined.ready')
              : t('marketplace.waiting.declined.again', { date: again })}
          </p>
        </>
      )}
      {state === 'declined' && waited && checklist.met && admin && (
        <MarketplaceApplyButton onApplied={onChanged} />
      )}
      {state === 'declined' && waited && checklist.met && !admin && (
        <p className="market-hint">{t('marketplace.notApplied.staff')}</p>
      )}
      {state === 'declined' && !checklist.met && <MarketplaceChecklist checklist={checklist} />}
    </section>
  );
}
