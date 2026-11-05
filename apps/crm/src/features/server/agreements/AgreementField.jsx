import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { FinanceField } from '../finance/FinanceField.jsx';

/** A field's validation reason as catalogue text, or ''. */
export function useFieldError(form, name) {
  const { t } = useI18n();
  const issue = form.errors[name];
  return issue ? t(`agreementForm.error.${issue.error}`, { max: issue.max }) : '';
}

/**
 * One labelled draft field on the shared finance field layout: an input, or a select when
 * `options` (`[value, text]` pairs) is given. Values stay text until `readDraft`.
 */
export function AgreementField({
  form,
  name,
  label,
  hint,
  wide,
  required = true,
  options,
  ...input
}) {
  const error = useFieldError(form, name);
  const change = (event) => form.change(name, event.target.value);
  return (
    <FinanceField
      name={name}
      label={label}
      hint={hint}
      wide={wide}
      required={required}
      error={error}
    >
      {(props) =>
        options ? (
          <select {...props} value={form.draft[name]} onChange={change}>
            {options.map(([value, text]) => (
              <option key={value} value={value}>
                {text}
              </option>
            ))}
          </select>
        ) : (
          <input {...props} {...input} value={form.draft[name]} onChange={change} />
        )
      }
    </FinanceField>
  );
}
