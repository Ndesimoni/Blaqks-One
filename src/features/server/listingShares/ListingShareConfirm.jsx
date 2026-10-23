import React, { useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { FinanceDialog } from '../finance/FinanceDialog.jsx';

/**
 * Confirms Accept, Decline, Withdraw or Stop sharing on a listing share. Accepting records
 * that the other company introduced this listing; declining may say "I already know this
 * listing", which matters as proof.
 */
export function ListingShareConfirm({ share, action, busy, message, onSubmit, onBack }) {
  const { t, format } = useI18n();
  const k = (key, vars) => t(`listingShareViews.${key}`, vars);
  const [known, setKnown] = useState(false);
  const vars = {
    company: share.from.company || k('otherCompany'),
    name: share.to.name || k('someone'),
    date: format.date(share.createdAt),
  };
  return (
    <FinanceDialog
      eyebrow={k('detailEyebrow', { reference: share.reference })}
      title={k(`confirm.${action}.title`)}
      intro={k(`confirm.${action}.body`, vars)}
      busy={busy}
      message={message}
      danger={action !== 'accept'}
      onClose={onBack}
      onSubmit={() => onSubmit(action === 'decline' ? { alreadyKnown: known } : undefined)}
      submitLabel={k(`confirm.${action}.button`)}
      dismissLabel={k('back')}
      className="record-share-dialog"
    >
      {action === 'decline' && (
        <label className="outside-share-check">
          <input
            type="checkbox"
            checked={known}
            onChange={(event) => setKnown(event.target.checked)}
          />
          <span>{k('alreadyKnown')}</span>
        </label>
      )}
    </FinanceDialog>
  );
}
