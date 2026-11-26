import React, { useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { failureText, FinanceDialog } from './FinanceDialog.jsx';
import { HandoverPreview } from './HandoverPreview.jsx';
import { useHandoverPreview } from './useHandoverPreview.js';

/** The two decisions inside the window, each gated by the server's `allowed` flags. */
function decisions(handover, actions, version, k) {
  if (handover.status === 'awaiting_approval')
    return [
      {
        label: k('approve'),
        can: actions.can('approveHandoverAcceptance', handover),
        run: () => actions.approveHandoverAcceptance(handover, version),
      },
      {
        label: k('reject'),
        can: actions.can('rejectHandoverAcceptance', handover),
        run: () => actions.rejectHandoverAcceptance(handover),
      },
    ];
  return [
    {
      label: k('accept'),
      can: actions.can('acceptHandover', handover),
      run: () => actions.decideHandover(handover, 'accept', version),
    },
    {
      label: k('decline'),
      can: actions.can('declineHandover', handover),
      run: () => actions.decideHandover(handover, 'decline'),
    },
  ];
}

/**
 * Review before deciding (agreements design §17, owner decision 1). The receiver reviews a
 * pending offer and accepts or declines it; the chosen approver or the Admin reviews an
 * accepted one and approves or rejects it. Accepting and approving name the agreement version
 * shown. An expired offer shows why and allows no decision.
 */
export function HandoverReviewDialog({ handover, onClose }) {
  const { api, workspaceId, actions, user } = useFinanceContext();
  const { t, format } = useI18n();
  const k = (key, vars) => t(`handoverReview.${key}`, vars);
  const review = useHandoverPreview(api, workspaceId, handover);
  const [message, setMessage] = useState('');
  const approving = handover.status === 'awaiting_approval';
  const { preview } = review;
  const offer = preview?.offer;
  const ready = review.status === 'ready' && !offer.expired;
  const [positive, negative] = decisions(handover, actions, offer?.agreementVersion, k);
  const names = { from: handover.from.name, to: handover.to.name };
  const decide = async (choice) => {
    setMessage('');
    const result = await choice.run();
    if (result.ok) return onClose();
    setMessage(failureText(result));
  };
  const acceptedAt = handover.approval?.acceptedAt;
  return (
    <FinanceDialog
      eyebrow={`DEALS · ${handover.dealId}`}
      title={k(approving ? 'approvalTitle' : 'answerTitle')}
      intro={k(approving ? 'approvalIntro' : 'answerIntro', names)}
      busy={actions.busy}
      message={message}
      onClose={onClose}
      onSubmit={positive.can ? () => decide(positive) : undefined}
      submitLabel={positive.label}
      dismissLabel={k('close')}
      submitDisabled={!ready}
      secondary={
        negative.can
          ? { label: negative.label, onClick: () => decide(negative), disabled: !ready }
          : null
      }
      wide
    >
      {review.status === 'loading' && (
        <p role="status" className="finance-hint">
          {k('loading')}
        </p>
      )}
      {review.status === 'error' && (
        <p className="field-error" role="alert">
          {k('loadFailed')}
        </p>
      )}
      {offer?.expired && (
        <p className="field-error" role="alert">
          {approving ? k('expiredApproval') : k('expiredAnswer', { name: names.from })}
        </p>
      )}
      {approving && (
        <p className="finance-note" role="note">
          {acceptedAt
            ? k('acceptedOn', { name: names.to, date: format.dateTime(acceptedAt) })
            : k('acceptedUnknown', { name: names.to })}{' '}
          {k('approvalSteps', { name: names.to })}
        </p>
      )}
      {!approving && handover.approval && (
        <p className="finance-note" role="note">
          {k('answerApproval', { name: handover.approval.approver.name })}
        </p>
      )}
      {offer?.expiresAt && !offer.expired && (
        <p className="finance-hint">{k('deadline', { date: format.dateTime(offer.expiresAt) })}</p>
      )}
      {preview && <HandoverPreview preview={preview} viewerId={user.id} />}
      {handover.agreementId && <p className="finance-hint">{t('handoverOffer.evidence')}</p>}
    </FinanceDialog>
  );
}
