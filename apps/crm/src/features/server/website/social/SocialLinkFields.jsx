import React from 'react';
import { useI18n } from '../../../../i18n/useI18n.js';
import { MAX_LINK, SOCIAL_FIELDS, normalize, socialError } from './socialModel.js';
import './social-links.css';

/**
 * The seven optional link inputs (six networks and Other website) for the Content tab, My
 * profile and the Admin's own Team dialog. `errors` holds `websiteSocial` catalogue keys per
 * field; `inputs` (optional) collects the elements so a form can focus the first invalid one.
 * A link typed without https:// becomes its canonical address when the field is left, or on
 * Enter before the form submits, whenever that address passes the check.
 */
export function SocialLinkFields(props) {
  const { idPrefix, values, errors = {}, disabled, inputs, onChange, legend, hint } = props;
  const { t } = useI18n();
  const hintId = `${idPrefix}-hint`;
  const tidy = (field, text) => {
    const next = normalize(field, text);
    if (next !== text && !socialError(field, next)) onChange(field, next);
  };
  return (
    <fieldset className="social-fields" aria-describedby={hint ? hintId : undefined}>
      <legend className={props.quietLegend ? 'sr-only' : 'social-legend'}>{legend}</legend>
      {hint && (
        <p className="social-hint" id={hintId}>
          {hint}
        </p>
      )}
      <div className="social-grid">
        {SOCIAL_FIELDS.map((field) => {
          const id = `${idPrefix}-${field}`;
          const error = errors[field];
          return (
            <div className={`field social-field social-field-${field}`} key={field}>
              <label htmlFor={id}>{t(`websiteSocial.field.${field}`)}</label>
              <input
                id={id}
                ref={(node) => {
                  if (inputs) inputs.current[field] = node;
                }}
                type="url"
                inputMode="url"
                autoComplete="url"
                autoCapitalize="none"
                spellCheck={false}
                maxLength={MAX_LINK}
                placeholder={t(`websiteSocial.example.${field}`)}
                value={values[field]}
                disabled={disabled}
                aria-invalid={Boolean(error)}
                aria-describedby={error ? `${id}-error` : undefined}
                onChange={(event) => onChange(field, event.target.value)}
                onBlur={(event) => tidy(field, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') tidy(field, event.currentTarget.value);
                }}
              />
              {error && (
                <p className="field-error" id={`${id}-error`}>
                  {t(`websiteSocial.${error}`)}
                </p>
              )}
            </div>
          );
        })}
      </div>
    </fieldset>
  );
}
