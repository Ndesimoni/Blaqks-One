import React from 'react';
import { Badge } from '../../../components/ui/Badge.jsx';
import { Button } from '../../../components/ui/Button.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { parseAed } from '../../../lib/finance/money.js';
import { ListingView } from '../finance/ListingView.jsx';
import { toProperty } from '../listingShares/listingShareLinks.js';
import { MarketplaceAgreement } from './MarketplaceAgreement.jsx';
import { MarketplaceAvatar } from './MarketplaceAvatar.jsx';
import { MarketplaceMatchChecklist } from './MarketplaceMatchChecklist.jsx';
import { offerTitle } from './requestText.js';

const STATES = {
  waiting: ['awaitingReview', 'amber'],
  chosen: ['selected', 'green'],
  not_chosen: ['notSelected', 'slate'],
  not_a_match: ['rejected', 'red'],
  ended: ['ended', 'slate'],
};

/** The offer's title and price, worded from the same safe facts its details show. */
function OfferSummary({ listing }) {
  const { t, format } = useI18n();
  const parsed = parseAed(listing.priceAed);
  const price =
    parsed.error || parsed.value === null ? listing.priceAed : format.money(parsed.value);
  return (
    <div className="market-offer-summary">
      <strong>{offerTitle(t, listing)}</strong>
      {price && (
        <span>
          {price}
          {listing.saleRental && ` · ${listing.saleRental}`}
        </span>
      )}
    </div>
  );
}

/**
 * One offer slot (marketplace redesign): its status, the broker, the property's title and
 * price, the matching checklist as ticks and the full shared facts behind a disclosure. The
 * poster decides on a waiting offer of an open request; a chosen offer carries its agreement.
 */
export function MarketplaceOfferSlot({
  answer,
  request,
  decide,
  busy,
  onDecision,
  onAgreement,
  onOpenBroker,
}) {
  const { t } = useI18n();
  const k = (key) => t(`marketplaceAnswers.${key}`);
  const [label, tone] = STATES[answer.state] || STATES.ended;
  return (
    <li className={`market-card market-slot is-${answer.state}`}>
      <div className="market-slot-head">
        <Badge tone={tone}>{k(label)}</Badge>
        <button
          type="button"
          className="market-broker"
          onClick={() => onOpenBroker(answer.memberId)}
          aria-label={t('marketplaceRequests.board.viewBroker', { name: answer.name })}
        >
          <MarketplaceAvatar name={answer.name} src="" />
          <strong>{answer.name}</strong>
        </button>
      </div>
      {answer.listing ? (
        <OfferSummary listing={answer.listing} />
      ) : (
        <p className="market-hint">{k('unavailable')}</p>
      )}
      <MarketplaceMatchChecklist checklist={answer.checklist} />
      {answer.listing && (
        <details className="market-details">
          <summary>{k('details')}</summary>
          <ListingView
            property={toProperty({ ...answer.listing, listingTitle: k('offeredProperty') })}
            file={() => null}
          />
        </details>
      )}
      {(answer.state === 'chosen' || answer.agreement) && (
        <MarketplaceAgreement answer={answer} request={request} busy={busy} onOpen={onAgreement} />
      )}
      {decide && (
        <div className="market-actions">
          <Button onClick={() => onDecision('select', answer.id)} disabled={busy}>
            {k('select')}
          </Button>
          <Button variant="light" onClick={() => onDecision('reject', answer.id)} disabled={busy}>
            {k('reject')}
          </Button>
        </div>
      )}
    </li>
  );
}
