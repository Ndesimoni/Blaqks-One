import React, { useState } from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { useFinanceContext } from './useFinanceRequests.js';
import { failureText, FinanceDialog } from './FinanceDialog.jsx';
import { HandoverOffer } from './HandoverOffer.jsx';
import { useHandoverAgreement } from './useHandoverAgreement.js';

/**
 * The receiving agent reviews the full offer and accepts exactly the version shown
 * (agreements design §14). A changed or expired offer is refused by the server and the
 * reason is shown here.
 */
export function AcceptHandoverDialog({ handover, onClose }) {
  const { api, workspaceId, actions } = useFinanceContext();
  const { t } = useI18n();
  const offer = useHandoverAgreement(api, workspaceId, handover);
  const [message, setMessage] = useState('');
  const agreement = offer.detail?.agreement;
  const submit = async () => {
    setMessage('');
    const result = await actions.decideHandover(handover, 'accept', agreement.version);
    if (result.ok) return onClose();
    setMessage(failureText(result));
  };
  return (
    <FinanceDialog
      eyebrow={`DEALS · ${handover.dealId}`}
      title={t('handoverOffer.acceptTitle')}
      intro={t('handoverOffer.acceptIntro', { name: handover.from.name })}
      busy={actions.busy}
      message={message}
      onClose={onClose}
      onSubmit={submit}
      submitLabel={t('handoverOffer.accept')}
      submitDisabled={offer.status !== 'ready' || Boolean(agreement?.expired)}
      wide
    >
      <HandoverOffer offer={offer} handover={handover} />
    </FinanceDialog>
  );
}
