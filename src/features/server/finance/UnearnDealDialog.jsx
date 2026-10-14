import React, { useId, useState } from 'react';
import { readableDate } from '../../../lib/dates.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { failureText, FinanceDialog, ReasonField } from './FinanceDialog.jsx';
import { reasonError } from './financeRules.js';

/**
 * Admin unearn (finance-design §4, §13 M-F4): returns an earned deal to "not earned" with a
 * required reason. The server refuses while approved payments remain; the reason stays.
 */
export function UnearnDealDialog({ deal, onClose, onDone }) {
  const { actions } = useFinanceContext();
  const id = useId();
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const submit = async () => {
    setMessage('');
    const result = await actions.unearnDeal(deal, reason);
    if (result.ok) return onDone();
    setMessage(failureText(result));
  };
  return (
    <FinanceDialog
      eyebrow={`DEALS · ${deal.dealId}`}
      title="Unearn deal"
      intro={`Earned on ${readableDate(deal.earnedOn)}. Unearning keeps the earned figures in the history and shows an estimate again.`}
      busy={actions.busy}
      message={message}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Unearn deal"
      submitDisabled={Boolean(reasonError(reason))}
      danger
    >
      <ReasonField id={`${id}-reason`} value={reason} onChange={setReason} />
    </FinanceDialog>
  );
}
