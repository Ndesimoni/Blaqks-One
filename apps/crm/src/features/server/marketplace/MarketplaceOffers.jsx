import React, { useId } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { MarketplaceOfferSlot } from './MarketplaceOfferSlot.jsx';

const LIVE = ['waiting', 'chosen'];

/**
 * The request's property offers as slots (marketplace redesign): live offers first, then, for
 * the poster of an open request, one "Free slot" per place left of the three, then earlier
 * offers. Only safe structured offer facts from the server are rendered before agreement
 * acceptance. Another broker sees only their own offers, so free slots are the poster's alone.
 */
export function MarketplaceOffers({
  answers,
  request,
  isPoster,
  open,
  active,
  busy,
  onDecision,
  onAgreement,
  onOpenBroker,
}) {
  const { t } = useI18n();
  const id = useId();
  const k = (key) => t(`marketplaceAnswers.${key}`);
  const free = isPoster && open ? Math.max(0, 3 - active) : 0;
  const slot = (answer) => (
    <MarketplaceOfferSlot
      key={answer.id}
      answer={answer}
      request={request}
      decide={isPoster && open && answer.state === 'waiting'}
      busy={busy}
      onDecision={onDecision}
      onAgreement={onAgreement}
      onOpenBroker={onOpenBroker}
    />
  );
  return (
    <section className="market-section" aria-labelledby={id}>
      <h3 id={id}>{k('offers')}</h3>
      {!answers.length && <p className="market-hint">{k('noOffers')}</p>}
      <ul className="market-offer-list">
        {answers.filter((answer) => LIVE.includes(answer.state)).map(slot)}
        {Array.from({ length: free }, (_, index) => (
          <li className="market-slot is-free" key={`free-${index}`}>
            <strong>{k('freeSlot')}</strong>
            <span>{k('freeSlotText')}</span>
          </li>
        ))}
        {answers.filter((answer) => !LIVE.includes(answer.state)).map(slot)}
      </ul>
    </section>
  );
}
