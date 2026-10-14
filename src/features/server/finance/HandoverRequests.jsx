import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { formatPercent } from '../../../lib/finance/money.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { failureText } from './FinanceDialog.jsx';

const decisions = [
  { decision: 'accept', label: 'Accept', variant: 'primary' },
  { decision: 'decline', label: 'Decline', variant: 'light' },
  { decision: 'cancel', label: 'Cancel request', variant: 'light' },
];

/** Who the request is for, from the caller's side. */
function summary(handover, me) {
  if (handover.to.id === me) return `${handover.from.name} offers you this deal`;
  if (handover.from.id === me) return `Waiting for ${handover.to.name} to respond`;
  return `${handover.from.name} → ${handover.to.name}`;
}

/**
 * Pending hand-over requests the caller takes part in (all of them for team finance). The
 * receiver sees the deal's ID, type, stage and earned state only — never its money — and
 * accepts or declines; the requester or Admin cancels; the Admin may approve with changes.
 */
export function HandoverRequests({ onApprove }) {
  const { overview, actions, user } = useFinanceContext();
  const [message, setMessage] = useState('');
  const pending = overview.handovers.filter((handover) => handover.status === 'pending');
  if (!pending.length) return null;
  const decide = async (handover, decision) => {
    setMessage('');
    const result = await actions.decideHandover(handover, decision);
    if (!result.ok) setMessage(failureText(result));
  };
  return (
    <section className="panel finance-handovers" aria-labelledby="finance-handovers-title">
      <div className="finance-calc-head">
        <h2 id="finance-handovers-title">Hand-over requests</h2>
        <span className="finance-chip estimate">{pending.length} awaiting response</span>
      </div>
      {message && (
        <p className="field-error" role="alert">
          {message}
        </p>
      )}
      <ul className="finance-handover-list">
        {pending.map((handover) => (
          <li key={handover.id} className="finance-handover">
            <div className="finance-handover-text">
              <strong>
                <Icon name="users" size={16} /> {handover.dealId} · {handover.dealType} ·{' '}
                {handover.stage}
                {handover.earned ? ' · Earned' : ''}
              </strong>
              <span>{summary(handover, user.id)}</span>
              <small>
                {handover.referralShareBp
                  ? `${handover.from.name} keeps a ${formatPercent(handover.referralShareBp)} referral share`
                  : 'Full hand-over'}
              </small>
            </div>
            <div
              className="finance-action-group"
              role="group"
              aria-label={`Hand-over of ${handover.dealId}`}
            >
              {decisions
                .filter((item) => actions.can(`${item.decision}Handover`, handover))
                .map((item) => (
                  <Button
                    key={item.decision}
                    variant={item.variant}
                    disabled={actions.busy}
                    aria-label={`${item.label} hand-over of ${handover.dealId}`}
                    onClick={() => decide(handover, item.decision)}
                  >
                    {item.label}
                  </Button>
                ))}
              {actions.can('approveHandover', handover) && (
                <Button
                  disabled={actions.busy}
                  aria-label={`Approve hand-over of ${handover.dealId}`}
                  onClick={() => onApprove(handover)}
                >
                  Approve
                </Button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
