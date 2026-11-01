import React, { useId } from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { MarketplaceApplyButton } from './MarketplaceApplyButton.jsx';
import { MarketplaceChecklist } from './MarketplaceChecklist.jsx';

/**
 * Waiting on the platform (broker marketplace §15), as one calm state panel: pending, declined
 * with its reason and the day the company may apply again, or revoked. A declined company
 * that no longer meets the checklist sees it below the panel.
 */
export function MarketplaceWaiting({ company, admin, onChanged }) {
  const { t, format } = useI18n();
  const id = useId();
  const { state, declineReason, canApplyFrom, checklist } = company;
  const declined = state === 'declined';
  const waited = !canApplyFrom || Date.parse(canApplyFrom) <= Date.now();
  const again = declined && canApplyFrom ? format.date(canApplyFrom) || canApplyFrom : '';
  return (
    <div className="market-gate">
      <section className="market-card market-state" aria-labelledby={id}>
        <span className="market-state-icon" aria-hidden="true">
          <Icon name={state === 'revoked' ? 'lock' : 'clock'} size={26} />
        </span>
        <h2 id={id}>{t(`marketplace.waiting.${state}.title`)}</h2>
        {state === 'pending' && <p>{t('marketplace.waiting.pending.text')}</p>}
        {state === 'revoked' && <p>{t('marketplace.waiting.revoked.text')}</p>}
        {declined && <p>{t('marketplace.waiting.declined.text')}</p>}
        {declined && declineReason && (
          <p className="market-reason">
            <span>{t('marketplace.waiting.declined.reason')}</span> {declineReason}
          </p>
        )}
        {declined && (
          <p className="market-hint">
            {waited
              ? t('marketplace.waiting.declined.ready')
              : t('marketplace.waiting.declined.again', { date: again })}
          </p>
        )}
        {declined && waited && checklist.met && admin && (
          <MarketplaceApplyButton onApplied={onChanged} />
        )}
        {declined && waited && checklist.met && !admin && (
          <p className="market-hint">{t('marketplace.notApplied.staff')}</p>
        )}
      </section>
      {declined && !checklist.met && <MarketplaceChecklist checklist={checklist} />}
    </div>
  );
}
