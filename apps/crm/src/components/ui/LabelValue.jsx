import React from 'react';

function LabelValue({ label, value }) {
  return (
    <div className="label-value">
      <span>{label}</span>
      <strong>{value || '—'}</strong>
    </div>
  );
}

export { LabelValue };
