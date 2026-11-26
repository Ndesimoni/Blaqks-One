import React from 'react';
import { useI18n } from '../../../../i18n/useI18n.js';
import { templateParts } from './whatsappModel.js';

/**
 * What the client receives, as an outgoing bubble: the template's own text with each value
 * filled in as it is typed, and a numbered place for each value still empty.
 */
export function TemplatePreview({ id, body, values }) {
  const { t } = useI18n();
  return (
    <figure className="wa-preview" aria-labelledby={`${id}-preview`}>
      <figcaption id={`${id}-preview`}>{t('whatsappSend.template.preview')}</figcaption>
      <p>
        {templateParts(body).map((part, index) => {
          if (part.text !== undefined)
            return <React.Fragment key={index}>{part.text}</React.Fragment>;
          const value = String(values[part.variable - 1] ?? '').trim();
          return (
            <mark key={index} className={'wa-slot' + (value ? ' is-filled' : '')}>
              {value || `{{${part.variable}}}`}
            </mark>
          );
        })}
      </p>
    </figure>
  );
}

/**
 * One labelled field per template value, with the shared rules as their description and a
 * field error beside any value WhatsApp would refuse.
 */
export function TemplateFields({ id, count, values, problems, fields, onChange }) {
  const { t } = useI18n();
  return (
    <>
      {Array.from({ length: count }, (_, index) => {
        const fieldId = `${id}-value-${index + 1}`;
        const problem = problems[index];
        return (
          <div key={fieldId} className="wa-field field">
            <label htmlFor={fieldId}>
              {t('whatsappSend.template.variable', { number: index + 1 })}
            </label>
            <input
              id={fieldId}
              ref={(element) => {
                fields.current[index] = element;
              }}
              value={values[index] ?? ''}
              maxLength={400}
              autoComplete="off"
              aria-invalid={problem ? 'true' : undefined}
              aria-describedby={problem ? `${fieldId}-error` : `${id}-rules`}
              onChange={(event) => onChange(index, event.target.value)}
            />
            {problem && (
              <p id={`${fieldId}-error`} className="field-error wa-field-error">
                {t(`whatsappSend.template.problem_${problem}`)}
              </p>
            )}
          </div>
        );
      })}
    </>
  );
}
