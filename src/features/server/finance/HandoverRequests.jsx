import React, { useState } from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { formatPercent } from '../../../lib/finance/money.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { failureText } from './FinanceDialog.jsx';
import { DealChip } from './DealChips.jsx';

/** Secondary responses first, so the positive response sits last (right, or full width). */
const decisions = [
  { decision: 'decline', label: 'Decline', variant: 'light' },
  { decision: 'cancel', label: 'Cancel request', variant: 'light' },
  { decision: 'accept', label: 'Accept', variant: 'primary', icon: 'check' },
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
    <section
      className="panel finance-handovers deal-handovers"
      aria-labelledby="finance-handovers-title"
    >
      <div className="finance-calc-head">
        <h2 id="finance-handovers-title">Hand-over requests</h2>
        <DealChip tone="amber" glyph="wait">
          {pending.length} awaiting response
        </DealChip>
      </div>
      {message && (
        <p className="field-error" role="alert">
          {message}
        </p>
      )}
      <ul className="finance-handover-list">
        {pending.map((handover) => (
          <li key={handover.id} className="finance-handover deal-handover">
            <span className="deal-handover-icon" aria-hidden="true">
              <Icon name="users" size={18} />
            </span>
            <div className="finance-handover-text">
              <strong>
                {handover.dealId} · {handover.dealType} · {handover.stage}
                {handover.earned ? ' · Earned' : ''}
              </strong>
              <span>{summary(handover, user.id)}</span>
              <span className="deal-handover-terms">
                <DealChip tone="slate" glyph={handover.referralShareBp ? 'move' : 'done'}>
                  {handover.referralShareBp ? 'Referral share' : 'Full hand-over'}
                </DealChip>
                {handover.referralShareBp ? (
                  <small>
                    {handover.from.name} keeps a {formatPercent(handover.referralShareBp)} referral
                    share
                  </small>
                ) : null}
              </span>
            </div>
            <div
              className="finance-action-group deal-handover-actions"
              role="group"
              aria-label={`Hand-over of ${handover.dealId}`}
            >
              {decisions
                .filter((item) => actions.can(`${item.decision}Handover`, handover))
                .map((item) => (
                  <Button
                    key={item.decision}
                    variant={item.variant}
                    icon={item.icon}
                    disabled={actions.busy}
                    aria-label={`${item.label} hand-over of ${handover.dealId}`}
                    onClick={() => decide(handover, item.decision)}
                  >
                    {item.label}
                  </Button>
                ))}
              {actions.can('approveHandover', handover) && (
                <Button
                  icon="check"
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
