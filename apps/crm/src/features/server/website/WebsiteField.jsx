import React from 'react';

export function WebsiteField({ name, label, value, onChange, hint, multiline, ...props }) {
  const id = `website-${name}`;
  const control = {
    id,
    value,
    onChange: (event) => onChange(event.target.value),
    ...(hint ? { 'aria-describedby': `${id}-hint` } : {}),
    ...props,
  };
  return (
    <div className="website-field">
      <label htmlFor={id}>{label}</label>
      {multiline ? <textarea {...control} rows={4} /> : <input {...control} />}
      {hint && <small id={`${id}-hint`}>{hint}</small>}
    </div>
  );
}
