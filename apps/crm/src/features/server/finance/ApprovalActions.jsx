import React from 'react';
import { Button } from '../../../components/ui/Button.jsx';
import { useFinanceContext } from './useFinanceRequests.js';
import { failureText } from './FinanceDialog.jsx';
import { selfReviewMessage } from './financeRules.js';
import { entryCode } from './entryFilters.js';

/**
 * Approve, Reject and Void for one payment or expense (finance-design §4, §16.3–§16.4). Each
 * appears only when the caller's `financeAccess` and the row's server `allowed` permit it.
 * An approver who may not decide a pending row (their own submission, edit or deal) sees the
 * separation-of-duties reason instead of the buttons. Approve has no reason; Reject and Void
 * open their reason dialogs through `onDialog`. Failures go to `onMessage`.
 */
export function ApprovalActions({ kind, entry, onDialog, onMessage }) {
  const { actions } = useFinanceContext();
  const code = entryCode(entry);
  const canApprove = actions.can('approveEntry', entry);
  const canReject = actions.can('rejectEntry', entry);
  const canVoid = actions.can('voidEntry', entry);
  if (!canApprove && !canReject && !canVoid)
    return actions.refusal('approveEntry', entry) === selfReviewMessage ? (
      <p className="finance-hint finance-duty" role="note">
        {selfReviewMessage}
      </p>
    ) : null;
  const approve = async () => {
    onMessage?.('');
    const result = await actions.decideEntry(kind, entry, 'approve');
    onMessage?.(result.ok ? '' : failureText(result, 'record'));
  };
  return (
    <div
      className="finance-action-group finance-approval"
      role="group"
      aria-label={`Decide ${code}`}
    >
      {canVoid && (
        <Button
          variant="light"
          className="finance-danger-light"
          disabled={actions.busy}
          aria-label={`Void ${code}`}
          onClick={() => onDialog('void', entry)}
        >
          Void
        </Button>
      )}
      {canReject && (
        <Button
          variant="light"
          disabled={actions.busy}
          aria-label={`Reject ${code}`}
          onClick={() => onDialog('reject', entry)}
        >
          Reject
        </Button>
      )}
      {canApprove && (
        <Button
          icon="check"
          disabled={actions.busy}
          aria-label={`Approve ${code}`}
          onClick={approve}
        >
          Approve
        </Button>
      )}
    </div>
  );
}
