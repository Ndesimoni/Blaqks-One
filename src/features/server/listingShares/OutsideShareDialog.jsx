import React, { useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { RecipientLookup } from '../agreements/RecipientLookup.jsx';
import { FinanceDialog } from '../finance/FinanceDialog.jsx';
import { dubaiDay } from './listingShareLinks.js';
import { OutsideShareFields } from './OutsideShareFields.jsx';
import { OutsideShareReview } from './OutsideShareReview.jsx';
import { OutsideShareSent } from './OutsideShareSent.jsx';
import { useListingShareActions } from './useListingShareActions.js';

/**
 * Share a listing with an agent at another company (record sharing R2): find them by their
 * exact sign-in email, choose the last day, the exact location and a note, then review what
 * they will see before and after accepting. Sending repeats the reviewed preview; if the
 * listing changed in between, the review opens again with the server's reason.
 */
export function OutsideShareDialog({ recordId, onSent, onClose }) {
  const { t } = useI18n();
  const k = (key, vars) => t(`listingShares.${key}`, vars);
  const actions = useListingShareActions();
  const [recipient, setRecipient] = useState(null);
  const [fields, setFields] = useState({ lastDay: dubaiDay(30), exact: false, note: '' });
  const [review, setReview] = useState(null);
  const [confirmed, setConfirmed] = useState(false);
  const [message, setMessage] = useState('');
  const [missing, setMissing] = useState(false);
  const [sent, setSent] = useState(null);
  if (sent) return <OutsideShareSent share={sent} onClose={onClose} />;
  const check = async () => {
    if (!recipient) return setMissing(true);
    setMessage('');
    const result = await actions.preview(recordId, fields.exact);
    if (!result.ok) return setMessage(result.message);
    setConfirmed(false);
    setReview(result.preview);
  };
  const send = async () => {
    setMessage('');
    const result = await actions.send({
      recordId,
      recipientWorkspaceId: recipient.workspaceId,
      recipientMemberId: recipient.memberId,
      viewEndsOn: fields.lastDay,
      exactLocation: fields.exact,
      note: fields.note.trim() || null,
      previewDigest: review.previewDigest,
    });
    if (result.ok) {
      onSent?.();
      return setSent(result.share);
    }
    setMessage(result.message);
    if (result.status === 409) setReview(null);
  };
  const needsConfirm = review?.warnings.some((code) => ['contact', 'links'].includes(code));
  const base = {
    eyebrow: k('dialogEyebrow'),
    busy: Boolean(actions.busy),
    message,
    onClose,
    className: 'record-share-dialog outside-share-dialog',
  };
  if (review)
    return (
      <FinanceDialog
        {...base}
        wide
        title={k('reviewTitle', { name: recipient.name })}
        intro={k('reviewIntro')}
        onSubmit={send}
        submitLabel={k('send')}
        submitDisabled={needsConfirm && !confirmed}
        secondary={{ label: k('back'), onClick: () => setReview(null) }}
      >
        <OutsideShareReview review={review} confirmed={confirmed} onConfirm={setConfirmed} />
      </FinanceDialog>
    );
  return (
    <FinanceDialog
      {...base}
      title={k('dialogTitle')}
      intro={k('dialogIntro')}
      onSubmit={check}
      submitLabel={k('review')}
    >
      <RecipientLookup
        recipient={recipient}
        error={missing && !recipient}
        missingText={k('chooseAgent')}
        onChange={(value) => {
          setRecipient(value);
          setMissing(false);
        }}
      />
      <OutsideShareFields value={fields} onChange={setFields} />
    </FinanceDialog>
  );
}
