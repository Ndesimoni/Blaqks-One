import React, { useId, useState } from 'react';
import { FinanceDialog } from '../finance/FinanceDialog.jsx';
import { useSession } from '../../../hooks/useSession.js';
import { useI18n } from '../../../i18n/useI18n.js';

/**
 * Approve, decline or revoke with a confirmation (broker marketplace MK1a): a decline and a
 * revocation always give a reason, which the company's Admin reads on their screen.
 */
export function MarketplaceDecision({ row, action, onClose, onDecided }) {
  const { api } = useSession();
  const { t } = useI18n();
  const id = useId();
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const needsReason = action !== 'approved';
  const k = (key, vars) => t(`marketplace.decisions.${key}`, vars);
  const submit = async () => {
    setBusy(true);
    setMessage('');
    try {
      await api.decideMarketplaceApplication(row.workspaceId, {
        applicationId: row.id,
        decision: action,
        ...(needsReason ? { reason: reason.trim() } : {}),
      });
      onDecided();
    } catch (failure) {
      setMessage(failure.message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <FinanceDialog
      eyebrow={t('marketplace.applications.eyebrow')}
      title={k(`${action}.title`)}
      intro={k(`${action}.intro`, {
        company: row.company || t('marketplace.applications.unnamed'),
      })}
      busy={busy}
      message={message}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={k(`${action}.submit`)}
      submitDisabled={needsReason && !reason.trim()}
      danger={action !== 'approved'}
      className={needsReason ? 'market-dialog-reason' : 'market-dialog-short'}
    >
      {needsReason && (
        <div className="field span-all">
          <label htmlFor={id}>{k(`${action}.reasonLabel`)}</label>
          <textarea
            id={id}
            rows={3}
            maxLength={500}
            value={reason}
            disabled={busy}
            onChange={(event) => setReason(event.target.value)}
          />
          <small className="finance-hint">{k(`${action}.reasonHint`)}</small>
        </div>
      )}
      <p className="market-decision-note">{k(`${action}.note`)}</p>
    </FinanceDialog>
  );
}
