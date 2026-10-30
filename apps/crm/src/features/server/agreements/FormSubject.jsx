import React, { useId } from 'react';
import { stageAndListingOptions } from '../../../config/fields/stageAndListingOptions.js';
import { useI18n } from '../../../i18n/useI18n.js';
import { optionsOf, unbroken } from './agreementDraft.js';
import { AgreementField } from './AgreementField.jsx';
import { PropertyFacts } from './AgreementTerms.jsx';

/**
 * The minimal frozen snapshot (design §6): property facts without any CRM record ID, and
 * the client as a first name and last initial. A contact channel is shared only when the
 * sender switches it on. Co-broking from a listing share shows the share's property as
 * fixed facts: the server adds them, whatever the form holds.
 */
export function FormSubject({ form, detail }) {
  const { t } = useI18n();
  const { draft } = form;
  const field = (name) => t(`agreementForm.field.${name}`);
  return (
    <>
      {draft.frozen ? (
        <div className="agreement-frozen">
          <PropertyFacts property={draft.frozen} />
          <p className="agreement-frozen-note">
            {t('agreementForm.hint.frozenProperty', { reference: unbroken(draft.frozen) })}
          </p>
        </div>
      ) : (
        <PropertyFields form={form} field={field} />
      )}
      {detail?.marketplaceRequestId ||
      detail?.marketplace === true ||
      detail?.revision?.terms?.introduction?.marketplace === true ? (
        <p className="market-hint">{t('marketplaceAgreement.clientPrivacy')}</p>
      ) : (
        <ClientFields form={form} field={field} />
      )}
    </>
  );
}

function PropertyFields({ form, field }) {
  const { t } = useI18n();
  const { draft } = form;
  return (
    <fieldset className="form-grid agreement-fieldset">
      <legend className="span-all">{t('agreementForm.section.property')}</legend>
      <AgreementField
        form={form}
        name="emirate"
        label={field('emirate')}
        options={optionsOf(stageAndListingOptions.Emirate, draft.emirate)}
      />
      <AgreementField form={form} name="area" label={field('area')} maxLength={80} />
      <AgreementField
        form={form}
        name="propertyType"
        label={field('propertyType')}
        options={optionsOf(stageAndListingOptions['Property type'], draft.propertyType)}
      />
      <AgreementField form={form} name="bedrooms" label={field('bedrooms')} inputMode="numeric" />
      <AgreementField form={form} name="sizeSqft" label={field('sizeSqft')} inputMode="numeric" />
      <AgreementField
        form={form}
        name="askingPrice"
        label={field('askingPrice')}
        inputMode="decimal"
        hint={t('agreementForm.hint.aed')}
      />
      <AgreementField
        form={form}
        name="listingRef"
        label={field('listingRef')}
        hint={t('agreementForm.hint.listingRef')}
        maxLength={40}
      />
    </fieldset>
  );
}

function ClientFields({ form, field }) {
  const { t } = useI18n();
  const id = useId();
  const { draft } = form;
  return (
    <fieldset className="form-grid agreement-fieldset">
      <legend className="span-all">{t('agreementForm.section.client')}</legend>
      <AgreementField
        form={form}
        name="clientName"
        label={field('clientName')}
        hint={t('agreementForm.hint.clientName')}
        maxLength={80}
        autoComplete="off"
      />
      <label className="agreement-check span-all" htmlFor={`${id}-share`}>
        <input
          id={`${id}-share`}
          type="checkbox"
          checked={draft.shareContact}
          onChange={(event) => form.change('shareContact', event.target.checked)}
        />
        <span>
          <strong>{t('agreementForm.field.shareContact')}</strong>
          <small>{t('agreementForm.hint.shareContact')}</small>
        </span>
      </label>
      {draft.shareContact && (
        <AgreementField
          form={form}
          name="contact"
          label={field('contact')}
          wide
          maxLength={120}
          autoComplete="off"
        />
      )}
    </fieldset>
  );
}
