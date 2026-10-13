import React from 'react';
import { LinkSelect } from './LinkSelect.jsx';

/**
 * `idPolicy` (connected only): `issued` makes a blank ID valid; `readOnly` locks the ID input.
 * `initialFocus` marks a candidate for the dialog's first focus; the Drawer skips disabled ones.
 */
export function RecordField({
  field: f,
  module,
  data,
  idField,
  idPolicy,
  initialFocus,
  value,
  error,
  change,
}) {
  const relation = (f) => {
    if (f.key === idField.key) return null;
    if (
      f.name === 'Client ID' ||
      f.name === 'Referred by Client ID' ||
      f.name === 'Referred client ID'
    )
      return { data: data.Clients, id: 'Client ID', name: 'Full name' };
    if (f.name === 'Property ID' || f.name === 'Property ID optional')
      return { data: data.Properties, id: 'Property ID', name: 'Listing title' };
    if (f.name === 'Contact ID')
      return { data: data.Contacts, id: 'Contact ID', name: 'Full name' };
    if (f.name === 'Deal ID' || f.name === 'Deal ID optional')
      return { data: data.Deals, id: 'Deal ID', name: 'Deal ID' };
    return null;
  };
  const v = value ?? '';
  const rel = relation(f);
  const isId = f.key === idField.key;
  const issued = isId && Boolean(idPolicy?.issued);
  const idLocked = isId && Boolean(idPolicy?.readOnly);
  const hint = issued || idLocked ? `${f.key}-hint` : undefined;
  const inputProps = {
    'aria-invalid': Boolean(error),
    'aria-describedby':
      [error ? `${f.key}-error` : '', hint].filter(Boolean).join(' ') || undefined,
    required: isId && !issued,
    'data-initial-focus': initialFocus || undefined,
  };
  return (
    <div className={'field ' + (f.type === 'textarea' ? 'span-all' : '')} key={f.key}>
      <label htmlFor={f.key}>
        {module === 'Properties' && f.name === 'Price / annual rent AED'
          ? 'Asking price / rent AED'
          : f.name}
        {isId && !issued && <span className="required"> *</span>}
      </label>
      {rel ? (
        <LinkSelect
          field={f}
          module={module}
          relation={rel}
          value={v}
          inputProps={inputProps}
          change={change}
        />
      ) : f.options ? (
        <select
          {...inputProps}
          id={f.key}
          value={v}
          onChange={(e) => change(f.key, e.target.value)}
        >
          <option value="">Select...</option>
          {v && !f.options.includes(v) && <option value={v}>{v}</option>}
          {f.options.map((o) => (
            <option key={o}>{o}</option>
          ))}
        </select>
      ) : f.type === 'textarea' ? (
        <textarea
          {...inputProps}
          id={f.key}
          rows="3"
          value={v}
          onChange={(e) => change(f.key, e.target.value)}
          placeholder={`Enter ${f.name.toLowerCase()}...`}
        />
      ) : (
        <input
          {...inputProps}
          id={f.key}
          type={f.type}
          min={f.type === 'number' ? '0' : undefined}
          step={f.type === 'number' ? 'any' : undefined}
          value={v}
          readOnly={idLocked || undefined}
          onChange={(e) => change(f.key, e.target.value)}
          placeholder={
            issued
              ? 'Issued when saved'
              : f.type === 'number'
                ? '0'
                : `Enter ${f.name.toLowerCase()}...`
          }
        />
      )}
      {hint && (
        <small id={hint} className="field-hint">
          {!issued
            ? 'Record IDs cannot be changed.'
            : idLocked
              ? 'Issued when saved. Record IDs are assigned by the CRM server.'
              : 'Issued when saved. Leave blank for the next ID, or enter your own.'}
        </small>
      )}
      {error && (
        <p id={`${f.key}-error`} className="field-error">
          {error}
        </p>
      )}
    </div>
  );
}
