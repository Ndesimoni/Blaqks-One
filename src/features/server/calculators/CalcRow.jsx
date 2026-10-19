import React from 'react';

/** One label/value line in a calculator result list. */
export function CalcRow({ label, value, strong = false }) {
  return (
    <div className={'calc-row' + (strong ? ' strong' : '')}>
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}
