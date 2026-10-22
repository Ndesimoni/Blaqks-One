import React, { useEffect, useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { announceHandoversChanged } from '../waitingCounts.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { failureText } from './FinanceDialog.jsx';
import { DealChip } from './DealChips.jsx';
import { openHandoverStatuses } from './dealResponses.js';
import { HandoverRow } from './HandoverRow.jsx';

/**
 * Open hand-over requests the caller takes part in (all of them for team finance): pending
 * offers and accepted ones waiting for approval (agreements design §17). The receiver reviews
 * an offer before deciding; the chosen approver or the Admin reviews an accepted one; the
 * requester or Admin cancels; the Admin may still approve in place of the receiver.
 */
export function HandoverRequests({ onApprove, onReview }) {
  const { overview, actions } = useFinanceContext();
  const { t } = useI18n();
  const [message, setMessage] = useState('');
  const open = overview.handovers.filter((handover) =>
    openHandoverStatuses.includes(handover.status),
  );
  // A changed list (a decision, a refresh) refreshes the sidebar's Deals badge too.
  useEffect(() => {
    announceHandoversChanged();
  }, [overview.handovers]);
  if (!open.length) return null;
  const decide = async (handover, decision) => {
    setMessage('');
    const result = await actions.decideHandover(handover, decision);
    if (!result.ok) setMessage(failureText(result));
  };
  return (
    <section
      className="panel finance-handovers deal-handovers"
      aria-labelledby="finance-handovers-title"
    >
      <div className="finance-calc-head">
        <h2 id="finance-handovers-title">{t('handoverRequests.title')}</h2>
        <DealChip tone="amber" glyph="wait">
          {t('handoverRequests.count', { count: open.length })}
        </DealChip>
      </div>
      {message && (
        <p className="field-error" role="alert">
          {message}
        </p>
      )}
      <ul className="finance-handover-list">
        {open.map((handover) => (
          <HandoverRow
            key={handover.id}
            handover={handover}
            onReview={onReview}
            onApprove={onApprove}
            onDecide={decide}
          />
        ))}
      </ul>
    </section>
  );
}
