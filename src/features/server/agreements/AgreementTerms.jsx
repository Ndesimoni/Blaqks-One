import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { shareFils } from './agreementModel.js';

function Facts({ title, rows }) {
  return (
    <section className="agreement-facts">
      <h3>{title}</h3>
      <dl>
        {rows.map(([label, value, wide]) => (
          <div key={label} className={wide ? 'is-wide' : ''}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

/**
 * One revision's frozen terms (docs/agreements-design.md §3, §6): property and client
 * snapshot, commission and both shares, governing emirate, offer end and notes. The same
 * view previews a new revision before it is saved. `names` labels each side's share. An
 * in-company hand-over (§14) may have no property or missing facts, and its shares are of
 * the receiving agent's commission, so they show no AED amount.
 */
export function AgreementTerms({ terms, names }) {
  const { t, format } = useI18n();
  const { property, client } = terms.subject;
  const { money } = terms;
  const commission = money.basis === 'agent_commission';
  const known = (value, show = (v) => v) =>
    value === null || value === undefined ? t('agreements.terms.notRecorded') : show(value);
  const share = (bp) => (
    <>
      <span className="agreement-figure">{format.percent(bp)}</span>
      {!commission && <small> · {format.money(shareFils(money.amountFils, bp))}</small>}
    </>
  );
  const side = (key, party) => {
    if (commission && names?.[party])
      return t(`agreements.terms.${party === 'sender' ? 'keptBy' : 'shareFor'}`, {
        name: names[party],
      });
    return names?.[party]
      ? t(`agreements.terms.${key}Named`, { name: names[party] })
      : t(`agreements.terms.${key}`);
  };
  return (
    <div className="agreement-terms">
      {property ? (
        <Facts
          title={t('agreements.terms.property')}
          rows={[
            [t('agreements.terms.emirate'), known(property.emirate)],
            [t('agreements.terms.area'), known(property.area)],
            [t('agreements.terms.propertyType'), known(property.propertyType)],
            [t('agreements.terms.bedrooms'), known(property.bedrooms, format.number)],
            [
              t('agreements.terms.size'),
              known(property.sizeSqft, (size) => t('agreements.terms.sqft', { size })),
            ],
            [t('agreements.terms.askingPrice'), known(property.askingPriceFils, format.money)],
            [t('agreements.terms.listingRef'), known(property.listingRef)],
          ]}
        />
      ) : (
        <section className="agreement-facts">
          <h3>{t('agreements.terms.property')}</h3>
          <p>{t('agreements.terms.noProperty')}</p>
        </section>
      )}
      <Facts
        title={t('agreements.terms.client')}
        rows={[
          [t('agreements.terms.clientName'), client.displayName],
          [t('agreements.terms.contact'), client.contact || t('agreements.terms.notShared')],
        ]}
      />
      <Facts
        title={t('agreements.terms.money')}
        rows={[
          [t('agreements.terms.basis'), t(`agreements.basis.${money.basis}`)],
          [
            t(commission ? 'agreements.terms.dealFee' : 'agreements.terms.amount'),
            <span key="amount" className="agreement-figure">
              {format.money(money.amountFils)}
            </span>,
          ],
          [side('senderShare', 'sender'), share(money.senderShareBp)],
          [side('recipientShare', 'recipient'), share(money.recipientShareBp)],
          [t('agreements.terms.payment'), t(`agreements.payment.${money.paymentExpectation}`)],
        ]}
      />
      <Facts
        title={t('agreements.terms.terms')}
        rows={[
          [t('agreements.terms.governingEmirate'), terms.governingEmirate],
          [t('agreements.terms.expires'), format.dateTime(terms.expiresAt)],
          [t('agreements.terms.notes'), terms.notes || t('agreements.terms.noNotes'), true],
        ]}
      />
    </div>
  );
}
