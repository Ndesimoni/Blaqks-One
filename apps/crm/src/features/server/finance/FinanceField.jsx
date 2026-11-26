import React, { useId } from 'react';
import { FieldHintIcon, FieldHintText, useFieldHint } from '../../../components/ui/FieldHint.jsx';
import { useI18n } from '../../../i18n/useI18n.js';

/**
 * One labelled control with its status hint, guidance and error, linked for assistive
 * technology. `hint` is always visible (status); `hintKey` is translated guidance that
 * follows the member's preference and can be reopened from the information icon.
 */
export function FinanceField({ name, label, required, hint, hintKey, error, wide, children }) {
  const id = useId();
  const { t } = useI18n();
  const guidance = useFieldHint(id);
  const guidanceText = hintKey ? t(hintKey) : '';
  const described = [
    hint ? `${id}-hint` : '',
    guidance.describedBy,
    error ? `${id}-error` : '',
  ].filter(Boolean);
  return (
    <div className={'field' + (wide ? ' span-all' : '')} {...guidance.scopeProps}>
      <label htmlFor={id}>
        {label}
        {required && <span className="required"> *</span>}
        {guidanceText && <FieldHintIcon state={guidance} />}
      </label>
      {children({
        id,
        name,
        'aria-invalid': Boolean(error),
        'aria-describedby': described.join(' ') || undefined,
      })}
      {hint && (
        <small id={`${id}-hint`} className="finance-hint">
          {hint}
        </small>
      )}
      <FieldHintText text={guidanceText} state={guidance} />
      {error && (
        <p id={`${id}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
