import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { useI18n } from '../../../i18n/useI18n.js';
import { AgreementTerms } from './AgreementTerms.jsx';
import { previewTerms } from './readDraft.js';

/**
 * The confirmation the design requires before anything is frozen (§6): the type, both
 * named participants and exactly the terms that the new revision will hold.
 */
export function FormReview({ form, mode, detail, names, number }) {
  const { t } = useI18n();
  if (!form.terms)
    return (
      <div className="agreement-notice is-error" role="alert">
        <Icon name="info" size={18} />
        <p>{t('agreementForm.review.incomplete')}</p>
      </div>
    );
  const kind = mode === 'create' ? form.draft.kind : detail.agreement.kind;
  const recipientCompany =
    mode === 'create' ? form.recipient?.company : detail.agreement.parties?.recipient?.company;
  return (
    <div className="agreement-review">
      <div className="agreement-notice is-info" role="note">
        <Icon name="shield" size={18} />
        <p>{t(`agreementForm.review.${mode}`, { number, name: names.recipient || '' })}</p>
      </div>
      <dl className="agreement-review-parties">
        <div>
          <dt>{t('agreementForm.review.kind')}</dt>
          <dd>{t(`agreements.kind.${kind}`)}</dd>
        </div>
        <div>
          <dt>{t('agreements.party.sender')}</dt>
          <dd>{names.sender || t('agreements.party.unknown')}</dd>
        </div>
        <div>
          <dt>{t('agreements.party.recipient')}</dt>
          <dd>
            {names.recipient || t('agreements.party.unknown')}
            {recipientCompany ? ` · ${recipientCompany}` : ''}
          </dd>
        </div>
      </dl>
      <AgreementTerms terms={previewTerms(kind, form.terms)} names={names} />
    </div>
  );
}
