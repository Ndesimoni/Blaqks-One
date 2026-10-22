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
 * view previews a new revision before it is saved. `names` labels each side's share.
 */
export function AgreementTerms({ terms, names }) {
  const { t, format } = useI18n();
  const { property, client } = terms.subject;
  const { money } = terms;
  const share = (bp) => (
    <>
      <span className="agreement-figure">{format.percent(bp)}</span>
      <small> · {format.money(shareFils(money.amountFils, bp))}</small>
    </>
  );
  const side = (key, party) =>
    names?.[party]
      ? t(`agreements.terms.${key}Named`, { name: names[party] })
      : t(`agreements.terms.${key}`);
  return (
    <div className="agreement-terms">
      <Facts
        title={t('agreements.terms.property')}
        rows={[
          [t('agreements.terms.emirate'), property.emirate],
          [t('agreements.terms.area'), property.area],
          [t('agreements.terms.propertyType'), property.propertyType],
          [t('agreements.terms.bedrooms'), format.number(property.bedrooms)],
          [t('agreements.terms.size'), t('agreements.terms.sqft', { size: property.sizeSqft })],
          [t('agreements.terms.askingPrice'), format.money(property.askingPriceFils)],
          [t('agreements.terms.listingRef'), property.listingRef],
        ]}
      />
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
            t('agreements.terms.amount'),
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
