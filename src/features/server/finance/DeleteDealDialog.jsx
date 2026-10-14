import React, { useState } from 'react';
import { useFinanceContext } from './useFinanceRequests.js';
import { failureText, FinanceDialog } from './FinanceDialog.jsx';

/** Admin delete of a deal that was never earned (finance-design §6.2), confirmed first. */
export function DeleteDealDialog({ deal, onClose, onDone }) {
  const { actions } = useFinanceContext();
  const [message, setMessage] = useState('');
  const submit = async () => {
    setMessage('');
    const result = await actions.deleteDeal(deal);
    if (result.ok) return onDone();
    setMessage(failureText(result));
  };
  return (
    <FinanceDialog
      eyebrow={`DEALS · ${deal.dealId}`}
      title={`Delete ${deal.dealId}?`}
      intro="This permanently removes the deal. Deals that were ever earned cannot be deleted."
      busy={actions.busy}
      message={message}
      onClose={onClose}
      onSubmit={submit}
      submitLabel="Delete deal"
      danger
    />
  );
}
