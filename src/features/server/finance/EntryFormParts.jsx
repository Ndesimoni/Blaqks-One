import React from 'react';
import { Icon } from '../../../components/ui/Icon.jsx';
import { FinanceField as Field } from './FinanceField.jsx';

/** The rejection reason a resubmission answers; shown to everyone who sees the row. */
export function EntryRejection({ entry }) {
  if (entry?.status !== 'rejected') return null;
  return (
    <p className="finance-note warning" role="note">
      <Icon name="info" size={16} />
      <span>
        Rejected{entry.reason ? `: ${entry.reason}` : '.'} Correct the details and resubmit.
      </span>
    </p>
  );
}

/**
 * Optional free-text fields as `[key, label, 'input'|'textarea', hint?]`. Lengths are checked
 * before saving; the server trims and stores blanks as empty.
 */
export function EntryTextFields({ bind, errors, fields }) {
  return fields.map(([key, label, type, hint]) => (
    <Field
      key={key}
      name={key}
      label={label}
      hint={hint}
      error={errors[key]}
      wide={type === 'textarea'}
    >
      {(props) =>
        type === 'textarea' ? (
          <textarea {...props} rows={3} {...bind(key)} />
        ) : (
          <input
            {...props}
            type={type === 'url' ? 'url' : 'text'}
            inputMode={type === 'url' ? 'url' : undefined}
            autoComplete="off"
            {...bind(key)}
          />
        )
      }
    </Field>
  ));
}

/** An amount input with a fixed "AED" prefix and right-aligned tabular figures. */
export function MoneyInput({ field, bind, name = 'amount' }) {
  return (
    <div className="finance-money-input">
      <span aria-hidden="true">AED</span>
      <input {...field} inputMode="decimal" autoComplete="off" {...bind(name)} />
    </div>
  );
}
