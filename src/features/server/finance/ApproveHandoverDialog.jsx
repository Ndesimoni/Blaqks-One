import React, { useId, useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { bpToPercent, parsePercent } from '../../../lib/finance/money.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { failureText, FinanceDialog, ReasonField } from './FinanceDialog.jsx';
import { reasonError } from './financeRules.js';
import { HandoverOffer } from './HandoverOffer.jsx';
import { useHandoverAgreement } from './useHandoverAgreement.js';

/**
 * Admin approval of a pending hand-over (finance-design §13 H-F1): the deal moves now, with
 * the requested referral share or an adjusted one (blank for none), and a required reason.
 * An offer recorded as an agreement shows its terms, names the version approved and keeps
 * its kind: a full hand-over stays full (agreements design §14).
 */
export function ApproveHandoverDialog({ handover, onClose }) {
  const { api, workspaceId, actions } = useFinanceContext();
  const { t } = useI18n();
  const offer = useHandoverAgreement(api, workspaceId, handover);
  const recorded = offer.status !== 'none';
  const fullStays = recorded && !handover.referralShareBp;
  const id = useId();
  const initial = handover.referralShareBp ? bpToPercent(handover.referralShareBp) : '';
  const [share, setShare] = useState(initial);
  const [reason, setReason] = useState('');
  const [message, setMessage] = useState('');
  const parsed = parsePercent(share);
  const submit = async () => {
    setMessage('');
    const version = offer.detail?.agreement.version;
    const result = await actions.approveHandover(handover, parsed.value, reason, version);
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
      submitDisabled={
        Boolean(parsed.error) || Boolean(reasonError(reason)) || offer.status === 'loading'
      }
      wide={recorded}
    >
      {recorded && <HandoverOffer offer={offer} handover={handover} />}
      {recorded && (
        <p className="finance-hint">
          {t('handoverOffer.approvalNote', { name: handover.to.name })}
        </p>
      )}
      <div className="field">
        <label htmlFor={`${id}-share`}>Referral share kept by {handover.from.name} %</label>
        <input
          id={`${id}-share`}
          inputMode="decimal"
          value={share}
          disabled={fullStays}
          aria-invalid={Boolean(parsed.error)}
          aria-describedby={`${id}-share-hint`}
          onChange={(event) => setShare(event.target.value)}
        />
        <small id={`${id}-share-hint`} className="finance-hint">
          {fullStays
            ? t('handoverOffer.fullStays')
            : `Leave blank for a full hand-over. Requested: ${initial ? `${initial}%` : 'full hand-over'}.`}
        </small>
        {parsed.error && <p className="field-error">{parsed.error}</p>}
      </div>
      <ReasonField id={`${id}-reason`} value={reason} onChange={setReason} />
    </FinanceDialog>
  );
}
