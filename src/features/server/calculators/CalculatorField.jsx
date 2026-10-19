import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';

/** One labelled calculator input with an optional prefix, suffix and translated error. */
export function CalculatorField({ id, label, prefix, suffix, value, onChange, error, hint }) {
  const { t } = useI18n();
  const errorId = `${id}-error`;
  return (
    <div className="calc-field">
      <label htmlFor={id}>{label}</label>
      <div className="calc-input">
        {prefix && <span aria-hidden="true">{prefix}</span>}
        <input
          id={id}
          inputMode="decimal"
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
        {suffix && <span aria-hidden="true">{suffix}</span>}
      </div>
      {error ? (
        <p id={errorId} className="field-error">
          {t(error)}
        </p>
      ) : (
        hint && <small className="calc-hint">{hint}</small>
      )}
    </div>
  );
}
