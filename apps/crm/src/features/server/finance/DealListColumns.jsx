import React from 'react';
import { readableDate } from '../../../lib/dates.js';
import { formatAed } from '../../../lib/finance/money.js';
import { PaymentChip, StageChip } from './DealChips.jsx';
import { holderName, referenceName } from './dealFilters.js';
import { Money, rowFigures } from './DealMoney.jsx';

/**
 * The Deals list's columns after the deal's name (design queue item 5): the approved mockup's
 * Client, Value and Stage, then ours: the agent (team view) and the caller's own figure, with
 * Net fee, Payment and Target close one tick away in the column chooser. Each is
 * `{ label, num?, extra?, cell(deal) }`; `t` reads `dealsBoard` labels.
 */
export function dealListColumns({ team, me, references, t }) {
  const label = (key) => t(`dealsBoard.${key}`);
  const figures = (deal) => rowFigures(deal, team);
  const target = (deal) => deal.details?.target_close_date;
  return [
    {
      label: label('colClient'),
      cell: (deal) => (
        <span className="cell-strong">
          {referenceName(references, 'Clients', deal.clientId) ?? deal.clientId}
        </span>
      ),
    },
    { label: label('colValue'), num: true, cell: (deal) => formatAed(deal.agreedValueFils) },
    { label: label('colStage'), cell: (deal) => <StageChip stage={deal.stage} /> },
    ...(team ? [{ label: label('colAgent'), cell: (deal) => holderName(deal.assignee, me) }] : []),
    {
      label: label(team ? 'companyShare' : 'yourCommission'),
      num: true,
      cell: (deal) => <Money value={figures(deal).share} estimate={figures(deal).estimate} />,
    },
    {
      label: label('colNetFee'),
      num: true,
      extra: true,
      cell: (deal) => <Money value={figures(deal).net} estimate={figures(deal).estimate} />,
    },
    {
      label: label('colPayment'),
      extra: true,
      cell: (deal) => (
        <span className="deal-payment-cell">
          <PaymentChip status={deal.paymentStatus} />
          {deal.earnedOn && (
            <small className="finance-sub">
              {t('dealsBoard.earned', { date: readableDate(deal.earnedOn) })}
            </small>
          )}
        </span>
      ),
    },
    {
      label: label('colTarget'),
      extra: true,
      cell: (deal) => (target(deal) ? readableDate(target(deal)) : '—'),
    },
  ];
}
