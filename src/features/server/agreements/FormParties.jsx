import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { withKind } from './agreementDraft.js';
import { KINDS } from './agreementModel.js';
import { RecipientLookup } from './RecipientLookup.jsx';

/**
 * Step one of a new agreement: the type (design §2) and the other company's named
 * participant. The caller is always the sending participant of their own draft.
 */
export function FormParties({ form }) {
  const { t } = useI18n();
  const { draft } = form;
  return (
    <div className="form-grid">
      <fieldset className="agreement-kinds span-all">
        <legend>{t('agreementForm.kind.legend')}</legend>
        {KINDS.map((kind) => (
          <label key={kind} className={draft.kind === kind ? 'is-selected' : ''}>
            <input
              type="radio"
              name="agreement-kind"
              value={kind}
              checked={draft.kind === kind}
              onChange={() => form.setDraft((current) => withKind(current, kind))}
            />
            <span>
              <strong>{t(`agreements.kind.${kind}`)}</strong>
              <small>{t(`agreementForm.kind.${kind}`)}</small>
            </span>
          </label>
        ))}
      </fieldset>
      <RecipientLookup
        recipient={form.recipient}
        onChange={form.setRecipient}
        error={Boolean(form.errors.recipient)}
      />
    </div>
  );
}
