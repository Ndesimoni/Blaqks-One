import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { readableDate } from '../../../lib/dates.js';
import { formatAed, formatPercent } from '../../../lib/finance/money.js';
import '../../records/panel/record-panel-cards.css';
import { holderName, referenceName } from './dealFilters.js';
import { rowFigures } from './DealMoney.jsx';
import { feeBasisLabels } from './financeLabels.js';
import { useFinanceContext } from './useFinanceRequests.js';

const withId = (name, id) => (name ? `${name} (${id})` : id);

/**
 * The deal's facts card on the slider's left (approved mockup): client and listing, value,
 * commission (the fee terms and net fee), target close, then ours: holder, second agent,
 * partner share and the earned date. Facts without a value are left out.
 */
export function DealFactsCard({ deal }) {
  const { t } = useI18n();
  const { overview, team, user } = useFinanceContext();
  const k = (key) => t(`dealPanel.${key}`);
  const refs = overview.references;
  const terms = deal.feeBasis === 'fixed' ? feeBasisLabels.fixed : formatPercent(deal.feeRateBp);
  const target = deal.details?.target_close_date;
  const partner = `${formatPercent(deal.partnerShareBp)}${deal.partnerName ? ` · ${deal.partnerName}` : ''}`;
  const facts = [
    ['client', withId(referenceName(refs, 'Clients', deal.clientId), deal.clientId)],
    [
      'property',
      deal.propertyId &&
        withId(referenceName(refs, 'Properties', deal.propertyId), deal.propertyId),
    ],
    ['value', formatAed(deal.agreedValueFils)],
    [
      'commission',
      [terms, deal.calculation && rowFigures(deal, team).net].filter(Boolean).join(' · '),
    ],
    ['targetClose', target && readableDate(target)],
    ['holder', holderName(deal.assignee, user.id)],
    ['secondAgent', deal.secondAgent?.name],
    ['partnerShare', partner],
    ['earned', deal.earnedOn ? readableDate(deal.earnedOn) : k('notEarned')],
  ].filter(([, value]) => value);
  return (
    <dl className="record-fact-card deal-facts" aria-label={k('facts')}>
      {facts.map(([key, value]) => (
        <div key={key}>
          <dt>{k(key)}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}
