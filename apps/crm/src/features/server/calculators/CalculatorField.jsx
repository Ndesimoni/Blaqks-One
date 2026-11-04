import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';

/** One labelled calculator input, its unit beside the label, with a translated error. */
export function CalculatorField({ id, label, unit, value, onChange, error, placeholder }) {
  const { t } = useI18n();
  const errorId = `${id}-error`;
  return (
    <div className="calc-field">
      <label htmlFor={id}>
        {label} {unit && <small>{unit}</small>}
      </label>
      <input
        id={id}
        inputMode="decimal"
        autoComplete="off"
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
      />
      {error && (
        <p id={errorId} className="field-error">
          {t(error)}
        </p>
      )}
    </div>
  );
}
