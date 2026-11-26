import React from 'react';
import { useI18n } from '../../../i18n/useI18n.js';
import { EMIRATES } from '../../signup/signupModel.js';

const EMIRATE_KEYS = {
  'abu-dhabi': 'AbuDhabi',
  dubai: 'Dubai',
  sharjah: 'Sharjah',
  ajman: 'Ajman',
  'umm-al-quwain': 'UmmAlQuwain',
  'ras-al-khaimah': 'RasAlKhaimah',
  fujairah: 'Fujairah',
};

// [field, input type, autocomplete, hint key, maximum length, wide]
const FIELDS = [
  ['displayName', 'text', 'organization', '', 120],
  ['tradeLicence', 'text', 'off', 'company.optional', 40],
  ['emirate'],
  ['officePhone', 'tel', 'tel', 'company.phoneHint', 40],
  ['officeAddress', 'text', 'street-address', 'company.optional', 200, true],
];

/** The mockup's company details: name, licence, emirate, office phone and address. */
export function CompanyFields({ form }) {
  const { t } = useI18n();
  const { draft, errors, busy, inputs, change } = form;
  return (
    <div className="acct-card-body company-fields">
      {FIELDS.map(([field, type, autoComplete, hint, max, wide]) => {
        const id = `company-${field}`;
        const error = errors[field];
        const described = error ? `${id}-error` : hint ? `${id}-hint` : undefined;
        const shared = {
          id,
          ref: (node) => {
            inputs.current[field] = node;
          },
          value: draft[field],
          disabled: busy,
          'aria-invalid': Boolean(error),
          'aria-describedby': described,
          onChange: (event) => change(field, event.target.value),
        };
        return (
          <div className={'field' + (wide ? ' wide' : '')} key={field}>
            <label htmlFor={id}>{t(`company.${field}`)}</label>
            {field === 'emirate' ? (
              <select {...shared}>
                <option value="">{t('company.emiratePlaceholder')}</option>
                {EMIRATES.map((value) => (
                  <option key={value} value={value}>
                    {t(`signupSetup.emirate${EMIRATE_KEYS[value]}`)}
                  </option>
                ))}
              </select>
            ) : (
              <input {...shared} type={type} autoComplete={autoComplete} maxLength={max} />
            )}
            {error ? (
              <p className="field-error" id={`${id}-error`}>
                {t(error)}
              </p>
            ) : (
              hint && (
                <small className="company-hint" id={`${id}-hint`}>
                  {t(hint)}
                </small>
              )
            )}
          </div>
        );
      })}
    </div>
  );
}
