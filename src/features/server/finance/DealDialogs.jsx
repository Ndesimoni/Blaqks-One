import React from 'react';
import { useFinanceContext } from './useFinanceRequests.js';
import { DealDetails } from './DealDetails.jsx';
import { DealEditor } from './DealEditor.jsx';
import { ApproveHandoverDialog } from './ApproveHandoverDialog.jsx';
import { FinanceDialog } from './FinanceDialog.jsx';

/**
 * The page-level dialog: a new deal, an Admin hand-over approval, or a deal's details. The
 * details read the latest deal from the overview by ID, so after a 409 refresh the stacked
 * dialogs submit the current version while keeping what the user typed. A deal that left
 * the caller's view shows a plain "no longer available" notice instead.
 */
export function DealDialogs({ dialog, close }) {
  const { overview } = useFinanceContext();
  if (!dialog) return null;
  if (dialog.kind === 'create') return <DealEditor deal={null} onClose={close} onDone={close} />;
  if (dialog.kind === 'approveHandover')
    return <ApproveHandoverDialog handover={dialog.handover} onClose={close} />;
  const deal = overview.deals.find((row) => row.id === dialog.dealId);
  if (!deal)
    return (
      <FinanceDialog eyebrow="DEALS" title="Deal unavailable" onClose={close}>
        <p>This record is no longer available to you.</p>
      </FinanceDialog>
    );
  return <DealDetails deal={deal} onClose={close} />;
}
