import React from 'react';
import { stageAndListingOptions } from '../../../config/fields/stageAndListingOptions.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { FinanceField } from '../finance/FinanceField.jsx';
import { BASES, PAYMENTS, expiryRange, optionsOf } from './agreementDraft.js';
import { AgreementField, useFieldError } from './AgreementField.jsx';
import { readShare } from './readDraft.js';

/** Both sides' shares from the entered percentage, once it is valid. */
function Split({ form, names }) {
  const { t, format } = useI18n();
  const share = readShare(form.draft.kind, form.draft.senderShare);
  if (share.error) return null;
  const side = (key, party, bp) =>
    t(`agreementForm.split.${key}`, {
      name: names[party] || t(`agreements.party.${party}`),
      share: format.percent(bp),
    });
  return (
    <p className="agreement-split span-all" role="status">
      <span>{side('sender', 'sender', share.value)}</span>
      <span>{side('recipient', 'recipient', 10_000 - share.value)}</span>
    </p>
  );
}

/**
 * Commission and terms (design §2–§3, §11): the agreed amount in AED, the sending
 * company's share as a percentage for referral and co-broking agreements, how payment is
 * expected, the governing emirate, the day the offer ends (up to 90 days) and notes.
 */
export function FormMoney({ form, names }) {
  const { t } = useI18n();
  const { draft } = form;
  const range = expiryRange();
  const notesError = useFieldError(form, 'notes');
  const field = (name) => t(`agreementForm.field.${name}`);
  const full = draft.kind === 'handover_full';
  return (
    <fieldset className="form-grid agreement-fieldset">
      <legend className="span-all">{t('agreementForm.section.money')}</legend>
      <AgreementField
        form={form}
        name="basis"
        label={field('basis')}
        options={BASES.map((basis) => [basis, t(`agreements.basis.${basis}`)])}
      />
      <AgreementField
        form={form}
        name="amount"
        label={field('amount')}
        inputMode="decimal"
        hint={t('agreementForm.hint.aed')}
      />
      {full ? (
        <p className="agreement-note span-all">{t('agreementForm.share.full')}</p>
      ) : (
        <AgreementField
          form={form}
          name="senderShare"
          label={t(`agreementForm.share.${draft.kind}`)}
          hint={t(`agreementForm.share.${draft.kind}Hint`)}
          inputMode="decimal"
        />
      )}
      <AgreementField
        form={form}
        name="paymentExpectation"
        label={field('paymentExpectation')}
        options={PAYMENTS.map((payment) => [payment, t(`agreements.payment.${payment}`)])}
      />
      <Split form={form} names={names} />
      {draft.kind === 'co_broking' && (
        <AgreementField
          form={form}
          name="collectingParty"
          label={t('agreementLifecycle.collectingParty')}
          hint={t('agreementLifecycle.collectingHint')}
          options={[
            ['', t('agreementLifecycle.chooseParty')],
            ...['sender', 'recipient'].map((party) => [
              party,
              names[party] || t(`agreements.party.${party}`),
            ]),
          ]}
        />
      )}
      <AgreementField
        form={form}
        name="governingEmirate"
        label={field('governingEmirate')}
        options={optionsOf(stageAndListingOptions.Emirate, draft.governingEmirate)}
      />
      <AgreementField
        form={form}
        name="expiresOn"
        label={field('expiresOn')}
        hint={t('agreementForm.hint.expiresOn')}
        type="date"
        min={range.min}
        max={range.max}
      />
      <FinanceField
        name="notes"
        label={field('notes')}
        hint={t('agreementForm.hint.notes', { count: [...draft.notes].length })}
        error={notesError}
        wide
      >
        {(props) => (
          <textarea
            {...props}
            rows={4}
            value={draft.notes}
            onChange={(event) => form.change('notes', event.target.value)}
          />
        )}
      </FinanceField>
    </fieldset>
  );
}
