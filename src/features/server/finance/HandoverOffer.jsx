import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { AgreementTerms } from '../agreements/AgreementTerms.jsx';
import '../agreements/agreement-terms.css';

/**
 * The frozen terms of a hand-over offer (agreements design §14–§15): the receiving agent
 * sees the full offer before accepting, and the Admin before approving. `offer` comes from
 * `useHandoverAgreement`.
 */
export function HandoverOffer({ offer, handover }) {
  const { t } = useI18n();
  if (offer.status === 'loading')
    return (
      <p role="status" className="finance-hint">
        {t('handoverOffer.loading')}
      </p>
    );
  if (offer.status !== 'ready')
    return (
      <p className="field-error" role="alert">
        {t('handoverOffer.loadFailed')}
      </p>
    );
  const { agreement, revision } = offer.detail;
  const names = { sender: handover.from.name, recipient: handover.to.name };
  return (
    <>
      {agreement.expired && (
        <p className="field-error" role="alert">
          {t('handoverOffer.expired', { name: handover.from.name })}
        </p>
      )}
      <AgreementTerms terms={revision.terms} names={names} />
      <p className="finance-hint">{t('handoverOffer.evidence')}</p>
    </>
  );
}
