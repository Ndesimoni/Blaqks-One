import React, { useState } from 'react';
import { useWorkspaceView } from '../../../../hooks/useWorkspace.js';
import { useI18n } from '../../../../i18n/useI18n.js';
import { FinanceDialog } from '../../finance/FinanceDialog.jsx';

/**
 * Confirms taking one listing off the website. The record stays in the CRM; showing it
 * again needs a new publication. Success closes the dialog and announces "Listing
 * withdrawn"; a refusal stays in the dialog with the server's reason.
 */
export function WithdrawListing({ title, publication, listings, onClose }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`websiteListings.${key}`, vars);
  const { setToast } = useWorkspaceView();
  const [message, setMessage] = useState('');
  const confirm = async () => {
    setMessage('');
    const result = await listings.withdraw(publication);
    if (!result.ok) return setMessage(result.message || k('withdrawFailed'));
    onClose();
    setToast(k('withdrawn'));
  };
  return (
    <FinanceDialog
      eyebrow={k('withdrawEyebrow')}
      title={k('withdrawTitle')}
      intro={k('withdrawBody', { title: title || k('thisListing') })}
      busy={listings.busy}
      message={message}
      danger
      onClose={onClose}
      onSubmit={confirm}
      submitLabel={k('withdrawConfirm')}
      className="website-withdraw-dialog"
    />
  );
}
