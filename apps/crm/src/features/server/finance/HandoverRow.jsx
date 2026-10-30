import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { DealChip } from './DealChips.jsx';

/** Who the request waits for, from the caller's side (agreements design §17). */
function summary(handover, me, k) {
  const names = { from: handover.from.name, to: handover.to.name };
  if (handover.status === 'awaiting_approval') {
    const approver = handover.approval?.approver;
    if (approver?.id === me) return k('yourApproval', names);
    const name = approver?.name ?? '';
    if (handover.from.id === me || handover.to.id === me) return k('waitingApproval', { name });
    return k('betweenWaiting', { ...names, name });
  }
  if (handover.to.id === me) return k('offersYou', names);
  if (handover.from.id === me) return k('waitingResponse', { name: names.to });
  return k('between', names);
}

/**
 * The row's buttons, secondary first so the positive one sits last. The receiver declines
 * inside the review window; an Admin who is not the receiver may decline here. Every button
 * follows the server's `allowed` flags through `actions.can`.
 */
function buttons(handover, me, actions, handlers) {
  const awaiting = handover.status === 'awaiting_approval';
  const receiver = handover.to.id === me;
  const can = (operation) => actions.can(operation, handover);
  return [
    !receiver && can('declineHandover') && ['decline', 'light', () => handlers.decide('decline')],
    can('cancelHandover') && ['cancel', 'light', () => handlers.decide('cancel')],
    !awaiting && receiver && can('reviewHandover') && ['review', 'primary', handlers.review],
    awaiting &&
      (can('approveHandoverAcceptance') || can('rejectHandoverAcceptance')) && [
        'reviewApproval',
        'primary',
        handlers.review,
      ],
    can('approveHandover') && ['approve', 'primary', handlers.approve],
  ].filter(Boolean);
}

/** One open hand-over request: the deal, who it waits for, its terms and the decisions. */
export function HandoverRow({ handover, onReview, onApprove, onDecide }) {
  const { actions, user } = useFinanceContext();
  const { t, format } = useI18n();
  const k = (key, vars) => t(`handoverRequests.${key}`, vars);
  const ids = { dealId: handover.dealId };
  const handlers = {
    decide: (decision) => onDecide(handover, decision),
    review: () => onReview(handover),
    approve: () => onApprove(handover),
  };
  const referral = Boolean(handover.referralShareBp);
  return (
    <li className="finance-handover deal-handover">
      <span className="deal-handover-icon" aria-hidden="true">
        <Icon name="users" size={18} />
      </span>
      <div className="finance-handover-text">
        <strong>
          {handover.dealId} · {handover.dealType} · {handover.stage}
          {handover.earned ? ` · ${k('earned')}` : ''}
        </strong>
        <span>{summary(handover, user.id, k)}</span>
        <span className="deal-handover-terms">
          <DealChip tone="slate" glyph={referral ? 'move' : 'done'}>
            {k(referral ? 'referral' : handover.toAdmin ? 'toAdmin' : 'full')}
          </DealChip>
          {handover.approval && (
            <DealChip tone="amber" glyph="wait">
              {k('needsApproval', { name: handover.approval.approver.name })}
            </DealChip>
          )}
          {referral && (
            <small>
              {k('keeps', {
                name: handover.from.name,
                share: format.percent(handover.referralShareBp),
              })}
            </small>
          )}
          {handover.expiresAt && (
            <small>{k('endsAt', { date: format.dateTime(handover.expiresAt) })}</small>
          )}
        </span>
      </div>
      <div
        className="finance-action-group deal-handover-actions"
        role="group"
        aria-label={k('group', ids)}
      >
        {buttons(handover, user.id, actions, handlers).map(([key, variant, onClick]) => (
          <Button
            key={key}
            variant={variant}
            icon={variant === 'primary' ? (key === 'approve' ? 'check' : 'eye') : undefined}
            disabled={actions.busy}
            aria-label={k(`${key}Label`, ids)}
            onClick={onClick}
          >
            {k(key)}
          </Button>
        ))}
      </div>
    </li>
  );
}
