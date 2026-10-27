import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { ListingView } from '../finance/ListingView.jsx';
import { toProperty } from '../listingShares/listingShareLinks.js';
import { MarketplaceMatchChecklist } from './MarketplaceMatchChecklist.jsx';
import { MarketplaceAgreement } from './MarketplaceAgreement.jsx';

const states = {
  waiting: 'awaitingReview',
  chosen: 'selected',
  not_chosen: 'notSelected',
  not_a_match: 'rejected',
  ended: 'ended',
};

/** Only safe structured offer facts from the server are rendered before agreement acceptance. */
export function MarketplaceOffers({
  answers,
  request,
  isPoster,
  open,
  busy,
  onDecision,
  onAgreement,
}) {
  const { t } = useI18n();
  const k = (key, vars) => t(`marketplaceAnswers.${key}`, vars);
  return (
    <section aria-label={k('offers')}>
      <h3>{k('offers')}</h3>
      {!answers.length && <p>{k('noOffers')}</p>}
      <ul className="market-offer-list">
        {answers.map((answer) => (
          <li className="market-card" key={answer.id}>
            <h4>{answer.name}</h4>
            <p>{k('state', { state: k(states[answer.state] || 'ended') })}</p>
            {answer.listing ? (
              <ListingView
                property={toProperty({ ...answer.listing, listingTitle: k('offeredProperty') })}
                file={() => null}
              />
            ) : (
              <p>{k('unavailable')}</p>
            )}
            <details>
              <summary>{k('checklist')}</summary>
              <MarketplaceMatchChecklist checklist={answer.checklist} />
            </details>
            {(answer.state === 'chosen' || answer.agreement) && (
              <MarketplaceAgreement
                answer={answer}
                request={request}
                busy={busy}
                onOpen={onAgreement}
              />
            )}
            {isPoster && open && answer.state === 'waiting' && (
              <div className="market-actions">
                <Button onClick={() => onDecision('select', answer.id)} disabled={busy}>
                  {k('select')}
                </Button>
                <Button
                  variant="light"
                  onClick={() => onDecision('reject', answer.id)}
                  disabled={busy}
                >
                  {k('reject')}
                </Button>
              </div>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}
