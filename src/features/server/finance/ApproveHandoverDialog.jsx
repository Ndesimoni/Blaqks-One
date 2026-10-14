import React, { useId, useState } from 'react';
import { bpToPercent, parsePercent } from '../../../lib/finance/money.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { failureText, FinanceDialog, ReasonField } from './FinanceDialog.jsx';
import { reasonError } from './financeRules.js';

/**
 * Admin approval of a pending hand-over (finance-design §13 H-F1): the deal moves now, with
 * the requested referral share or an adjusted one (blank for none), and a required reason.
 */
export function ApproveHandoverDialog({ handover, onClose }) {
  const { actions } = useFinanceContext();
  const id = useId();
  const initial = handover.referralShareBp ? bpToPercent(handover.referralShareBp) : '';
  const [share, setShare] = useState(initial);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const parsed = parsePercent(share);
  const submit = async () => {
    setMessage('');
    const result = await actions.approveHandover(handover, parsed.value, reason);
    if (result.ok) return onClose();
    setMessage(failureText(result));
  };
  return (
    <FinanceDialog
      eyebrow={`DEALS · ${handover.dealId}`}
      title="Approve hand-over"
      intro={`${handover.from.name} → ${handover.to.name}. The deal moves as soon as you approve.`}
      busy={actions.busy}
      message={message}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Approve hand-over"
      submitDisabled={Boolean(parsed.error) || Boolean(reasonError(reason))}
    >
      <div className="field">
        <label htmlFor={`${id}-share`}>Referral share kept by {handover.from.name} %</label>
        <input
          id={`${id}-share`}
          inputMode="decimal"
          value={share}
          aria-invalid={Boolean(parsed.error)}
          aria-describedby={`${id}-share-hint`}
          onChange={(event) => setShare(event.target.value)}
        />
        <small id={`${id}-share-hint`} className="finance-hint">
          Leave blank for a full hand-over. Requested: {initial ? `${initial}%` : 'full hand-over'}.
        </small>
        {parsed.error && <p className="field-error">{parsed.error}</p>}
      </div>
      <ReasonField id={`${id}-reason`} value={reason} onChange={setReason} />
    </FinanceDialog>
  );
}
